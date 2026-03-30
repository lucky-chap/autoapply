import { auth0 } from "@/lib/auth0"
import { NextRequest, NextResponse } from "next/server"

export const GET = async (req: NextRequest) => {
  try {
    const res = await auth0.middleware(req);
    console.log("Auth0 Route Handler GET:", req.nextUrl.pathname);
    console.log("Expected connectAccount route:", (auth0 as any).routes.connectAccount);
    console.log("Match?", req.nextUrl.pathname === (auth0 as any).routes.connectAccount);
    console.log("Auth0 Middleware Response Status:", res.status);
    if (res.headers.get("x-middleware-next") === "1") {
      console.log("Auth0 Middleware returned pass-through (next()) for:", req.nextUrl.pathname);
    }
    return res;
  } catch (error: any) {
    console.error("Auth0 Route Handler Error:", error);
    if (error.cause) {
      console.error("Error Cause:", error.cause);
      if (error.cause.status) {
        console.error("Auth0 API response status:", error.cause.status);
      }
    }
    // Return the specific Auth0 error message from the SDK
    return NextResponse.json({ 
      error: error.message,
      code: error.code,
      cause: error.cause 
    }, { status: error.cause?.status ?? 500 });
  }
};

export const POST = async (req: NextRequest) => {
  try {
    console.log("Auth0 Route Handler POST:", req.nextUrl.pathname);
    const res = await auth0.middleware(req);
    console.log("Auth0 Middleware Response Status:", res.status);
    return res;
  } catch (error: any) {
    console.error("Auth0 Route Handler Error (POST):", error);
    return new Response(error.message || "Internal Server Error", { status: 500 });
  }
};
