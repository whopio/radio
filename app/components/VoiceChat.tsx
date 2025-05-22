"use client";

import { useEffect, useRef, useState } from "react";
import { WhopClientSdk } from "@whop/api";

export default function VoiceChat({
  experienceId,
  username,
  profilePic,
}: {
  experienceId: string;
  username: string;
  profilePic: string;
}) {
  const ROOM_ID = experienceId;
  const [muted, setMuted] = useState(true);

  const [socketId, setSocketId] = useState<string | null>(null);
  const [users, setUsers] = useState<
    {
      id: string;
      username: string;
      profilePic: string;
    }[]
  >([]);

  // biome-ignore lint/suspicious/noExplicitAny: no thank yuou
  const socketRef = useRef<any>(null);
  const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});
  const localStream = useRef<MediaStream | null>(null);

  // Setup mic
  const setupMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getAudioTracks()) {
      track.enabled = false;
    }
    localStream.current = stream;
    console.log("🎤 Got local audio stream (muted)");
  };

  const createPeerConnection = (peerId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Send ICE to other peer
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit("signal", {
          to: peerId,
          data: { candidate: e.candidate },
        });
      }
    };

    // When remote audio arrives
    pc.ontrack = (e) => {
      const remoteAudio = new Audio();
      remoteAudio.srcObject = e.streams[0];
      remoteAudio.autoplay = true;
      document.body.appendChild(remoteAudio);
    };

    // Add local audio to connection
    if (localStream.current) {
      for (const track of localStream.current.getTracks()) {
        // biome-ignore lint/style/noNonNullAssertion: no thank you
        pc.addTrack(track, localStream.current!);
      }
    }

    return pc;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: no thank you
  useEffect(() => {
    setupMedia().then(() => {
      const ws = WhopClientSdk().ConnectToWebsocket({
        joinExperience: experienceId,
        onMessage: async (message) => {
          const obj = message.appMessage;
          if (!obj) return;

          const parsed = JSON.parse(obj.json || "{}");
          const {
            type,
            from,
            to,
            data,
            username: newUser,
            profilePic: newPic,
          } = parsed;

          if (type === "user-joined" && from !== socketId) {
            setUsers((prev) => [
              ...prev,
              { id: from, username: newUser, profilePic: newPic },
            ]);

            const pc = createPeerConnection(from);
            peerConnections.current[from] = pc;

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            ws.send({
              broadcastAppMessage: {
                json: JSON.stringify({
                  type: "signal",
                  to: from,
                  from: socketId,
                  data: { offer },
                }),
                channel: { type: "EXPERIENCE", id: experienceId },
              },
            });
          }

          if (type === "signal" && to === socketId && from) {
            let pc = peerConnections.current[from];
            if (!pc) {
              pc = createPeerConnection(from);
              peerConnections.current[from] = pc;
            }

            if (data.offer) {
              await pc.setRemoteDescription(
                new RTCSessionDescription(data.offer)
              );
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              ws.send({
                broadcastAppMessage: {
                  json: JSON.stringify({
                    type: "signal",
                    to: from,
                    from: socketId,
                    data: { answer },
                  }),
                  channel: { type: "EXPERIENCE", id: experienceId },
                },
              });
            } else if (data.answer) {
              await pc.setRemoteDescription(
                new RTCSessionDescription(data.answer)
              );
            } else if (data.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch (err) {
                console.error("ICE error", err);
              }
            }
          }
        },
        onStatusChange: (status) => {
          if (status === "connected") {
            const id = crypto.randomUUID(); // replace with your user ID if you have it
            setSocketId(id);

            ws.send({
              broadcastAppMessage: {
                json: JSON.stringify({
                  type: "user-joined",
                  from: id,
                  username,
                  profilePic,
                }),
                channel: { type: "EXPERIENCE", id: experienceId },
              },
            });
          }
        },
      });

      return ws.connect();
    });

    return () => {
      for (const id in peerConnections.current) {
        peerConnections.current[id]?.close();
      }
    };
  }, [ROOM_ID]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-2xl px-4">
        <div className="flex flex-col items-center mb-8">
          <button
            type="button"
            onClick={() => {
              setMuted((prev) => {
                const next = !prev;
                if (localStream.current) {
                  for (const track of localStream.current.getAudioTracks()) {
                    track.enabled = !next; // mute = false => enable
                  }
                }
                return next;
              });
            }}
            className={`w-48 h-48 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-200 transform hover:scale-105 ${
              muted
                ? "bg-red-600 hover:bg-red-700 animate-pulse"
                : "bg-green-600 hover:bg-green-700"
            } text-white shadow-lg focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
              muted ? "focus:ring-red-500" : "focus:ring-green-500"
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="text-4xl mb-2">{muted ? "🔇" : "🎤"}</span>
              <span>{muted ? "Unmute" : "Mute"}</span>
            </div>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 w-full">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            Connected Users
          </h2>
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="relative">
                  <img
                    src={user.profilePic}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                  />
                  <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{user.username}</p>
                  <p className="text-sm text-gray-500">Connected</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
