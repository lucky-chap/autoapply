"use node"
import { generateText } from "ai"
import { vertex } from "@ai-sdk/google-vertex"

// Vertex AI Gemini is used for structured extraction and generation in tools.
// This is only imported on the Next.js server (API routes) to avoid 
// Convex environment compatibility issues.
export async function callVertexDirect(
  prompt: string,
  maxTokens = 4000
): Promise<string> {
  try {
    const { text } = await generateText({
      model: vertex("gemini-2.5-flash"),
      prompt,
    } as any)
    return text
  } catch (error) {
    console.error("Vertex AI Direct Error:", error)
    throw error
  }
}
