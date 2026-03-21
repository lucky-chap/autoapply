import { auth0 } from "@/lib/auth0"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { callGLM } from "@/lib/glm"
import { NextResponse } from "next/server"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(req: Request) {
  const session = await auth0.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobDescription, company, role } = await req.json()
  const userId = session.user.sub

  const profile = await convex.query(api.resumeProfiles.getByUser, { userId })
  if (!profile) {
    return NextResponse.json({ error: "No resume profile found. Upload your CV first." }, { status: 400 })
  }

  const prompt = `You are writing a job application cover letter on behalf of a candidate.

CANDIDATE PROFILE:
Skills: ${profile.skills.join(", ")}
Experience: ${JSON.stringify(profile.experience)}
Writing tone: ${profile.tone}
Resume summary: ${profile.rawText}

COMPANY: ${company}
ROLE: ${role}

JOB DESCRIPTION:
${jobDescription}

Write a concise, personalised cover letter that:
1. Uses the exact company name "${company}" and role title "${role}" — NEVER use placeholders like [Company Name]
2. Matches the company tone from the job description
3. Highlights 2-3 skills that directly match the job requirements
4. References specific details from the posting
5. Sounds like a real person, not a template
6. Is 3 short paragraphs max

Return only the cover letter body text. No subject line, no greeting header, no sign-off name.`

  const coverLetter = await callGLM(prompt)

  return NextResponse.json({ coverLetter })
}
