import { tool } from "ai";
import { z } from "zod";
import { convex, api, getAuthenticatedUser } from "./_context";

const parameters = z.object({});

export const getMyPreferencesTool = tool({
  description: "Get the user's job search preferences (target roles, locations, salary).",
  parameters: parameters as any,
  execute: async ({}: any) => {
    const user = await getAuthenticatedUser();
    return await convex.query(api.preferences.getByUser, { userId: user.sub });
  },
} as any);
