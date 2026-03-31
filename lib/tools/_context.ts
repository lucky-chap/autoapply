import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { getUser } from "../auth0";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

export const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export const getAuthenticatedUser = async () => {
  const user = await getUser();
  if (!user || !user.sub) {
    throw new Error("Unauthorized");
  }
  return user;
};

export { api };
