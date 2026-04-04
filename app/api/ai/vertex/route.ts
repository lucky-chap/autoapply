import { NextResponse } from "next/server"
import { callVertexDirect } from "@/lib/vertex-direct"

export async function POST(req: Request) {
  try {
    // Basic auth check using CONVEX_API_SECRET
    const authHeader = req.headers.get("Authorization")
    const secret = process.env.CONVEX_API_SECRET

    if (secret && authHeader !== `Bearer ${secret}`) {
      console.error("[api/ai/vertex] Unauthorized attempt")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { prompt, maxTokens } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    console.log("[api/ai/vertex] Calling direct vertex for prompt length:", prompt.length)
    const text = await callVertexDirect(prompt, maxTokens || 4000)
    
    return NextResponse.json({ text })
  } catch (error) {
    console.error("[api/ai/vertex] API error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
