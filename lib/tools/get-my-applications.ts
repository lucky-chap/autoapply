import { tool } from "ai";
import { z } from "zod";
import { convex, api, getAuthenticatedUser } from "./_context";

const parameters = z.object({});

export const getMyApplicationsTool = tool({
  description: "Get a list of job applications sent by the user.",
  parameters: parameters as any,
  execute: async ({}: any) => {
    const user = await getAuthenticatedUser();
    return await convex.query(api.applications.getByUser, { userId: user.sub });
  },
} as any);
