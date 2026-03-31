import { generateText } from "ai"
import { vertex } from "@ai-sdk/google-vertex"

// Vertex AI Gemini is used for structured extraction and generation in tools.
export async function callVertex(
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
    console.error("Vertex AI error:", error)
    throw error
  }
}
