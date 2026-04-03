import { auth0 } from "@/lib/auth0"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { callGLM } from "@/lib/glm"
import { NextResponse } from "next/server"
import { extractText } from "unpdf"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(req: Request) {
  try {
    const session = await auth0.getSession()
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { fileId } = await req.json()
    const userId = session.user.sub

    // Get file URL from Convex storage
    const fileUrl = await convex.query(api.resumeProfiles.getFileUrl, {
      fileId,
    })
    if (!fileUrl) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Fetch and extract text from the PDF
    const fileRes = await fetch(fileUrl)
    const fileBuffer = await fileRes.arrayBuffer()
    const { text } = await extractText(new Uint8Array(fileBuffer))
    const resumeText = text.join("\n").slice(0, 4000)

    // Extract profile URLs from resume text
    const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi
    const foundUrls = resumeText.match(urlRegex) ?? []
    const githubUrl = foundUrls.find((u) =>
      /github\.com\/[a-zA-Z0-9_-]+/i.test(u),
    )
    const linkedinUrl = foundUrls.find((u) =>
      /linkedin\.com\/in\//i.test(u),
    )
    const portfolioUrl = foundUrls.find(
      (u) =>
        !u.includes("github.com") &&
        !u.includes("linkedin.com") &&
        !u.includes("googleapis.com") &&
        !u.includes("google.com"),
    )

    if (!resumeText.trim()) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from PDF. Make sure it's not a scanned image.",
        },
        { status: 400 },
      )
    }

    const result = await callGLM(
      `You are a resume parser. Analyze this resume text and extract structured data.

RESUME TEXT:
${resumeText}

Return ONLY a JSON object with EXACTLY these fields (no other fields):
{
  "skills": ["skill1", "skill2"],
  "experience": [
    {"title": "Job Title", "company": "Company Name", "years": 2}
  ],
  "tone": "Professional",
  "rawText": "plain text summary of key resume content"
}

Rules:
- "skills" is an array of strings
- "experience" is an array of objects, each with "title" (string), "company" (string), "years" (number)
- "tone" is a 1-2 word string like "Professional", "Technical", "Conversational"
- "rawText" is a plain text summary, max 500 words
- Return ONLY the JSON object, no markdown, no explanation`,
    )

    // Extract JSON from response
    const cleaned = result
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim()

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: result },
        { status: 500 },
      )
    }

    const raw = JSON.parse(jsonMatch[0])

    // Normalize the response - handle field name variations
    const parsed = {
      skills: Array.isArray(raw.skills)
        ? raw.skills.map(String)
        : [],
      experience: Array.isArray(raw.experience)
        ? raw.experience.map((exp: Record<string, unknown>) => ({
            title: String(exp.title || exp.position || exp.role || "Unknown"),
            company: String(exp.company || exp.organization || "Unknown"),
            years: Number(exp.years || exp.duration || exp.year || 1),
          }))
        : [],
      tone: String(raw.tone || raw.writing_tone || "Professional"),
      rawText: String(raw.rawText || raw.raw_text || raw.summary || ""),
    }

    // Save parsed profile to Convex
    await convex.mutation(api.resumeProfiles.upsert, {
      userId,
      fileId,
      skills: parsed.skills,
      experience: parsed.experience,
      tone: parsed.tone,
      rawText: parsed.rawText,
      ...(githubUrl ? { githubUrl } : {}),
      ...(linkedinUrl ? { linkedinUrl } : {}),
      ...(portfolioUrl ? { portfolioUrl } : {}),
    })

    return NextResponse.json({ success: true, profile: parsed })
  } catch (error) {
    console.error("Parse resume error:", error)
    const message =
      error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
