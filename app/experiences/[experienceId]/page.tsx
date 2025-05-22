import VoiceChat from "@/app/components/VoiceChat";
import { whopApi } from "@/lib/whop-api";
import { verifyUserToken } from "@whop/api";
import { headers } from "next/headers";

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ experienceId: string }>;
}) {
  // The headers contains the user token
  const headersList = await headers();

  // The experienceId is a path param
  // This can be configured in the Whop Dashboard as the "app path". It should be /experiences/[experienceId]
  const { experienceId } = await params;

  // The user token is in the headers
  const { userId } = await verifyUserToken(headersList);

  const result = await whopApi.checkIfUserHasAccessToExperience({
    userId,
    experienceId,
  });

  const user = await whopApi.getUser({
    userId,
  });

  if (!result.hasAccessToExperience.hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-gray-600">
            You do not have access to this experience
          </p>
        </div>
      </div>
    );
  }

  // Either: 'admin' | 'customer' | 'no_access';
  // 'admin' means the user is an admin of the whop, such as an owner or moderator
  // 'customer' means the user is a common member in this whop
  // 'no_access' means the user does not have access to the whop
  const { accessLevel } = result.hasAccessToExperience;

  return (
    <main className="min-h-screen bg-gray-50">
      <VoiceChat
        experienceId={experienceId}
        username={user.publicUser.username}
        profilePic={
          user.publicUser.profilePicture?.sourceUrl || "/default-avatar.png"
        }
      />
    </main>
  );
}
