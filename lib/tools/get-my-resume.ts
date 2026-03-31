import { tool } from "ai";
import { z } from "zod";
import { convex, api, getAuthenticatedUser } from "./_context";

const parameters = z.object({});

export const getMyResumeTool = tool({
  description: "Get the user's current resume profile details.",
  parameters: parameters as any,
  execute: async ({}: any) => {
    const user = await getAuthenticatedUser();
    return await convex.query(api.resumeProfiles.getByUser, { userId: user.sub });
  },
} as any);
