import { auth0 } from "@/lib/auth0"
import { callVertex } from "@/lib/vertex"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const apiSecret = process.env.CONVEX_API_SECRET;
  
  let isAuthenticated = false;
  
  if (apiSecret && authHeader === `Bearer ${apiSecret}`) {
    isAuthenticated = true;
  } else {
    const session = await auth0.getSession();
    if (session) isAuthenticated = true;
  }

  if (!isAuthenticated)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prospect, job, profile } = await req.json()

  if (!prospect || !job || !profile) {
    return NextResponse.json(
      { error: "Prospect, job, and profile data are required." },
      { status: 400 },
    )
  }

  const isGenericProspect = prospect.name === "Hiring Contact"
  const prompt = `
    You are an expert at cold outreach for jobs.
    Write a short, professional, and highly personalized email to a hiring decision-maker.

    PROSPECT:
    Name: ${isGenericProspect ? "Unknown (use 'Hi there' or 'Hello' instead of a name)" : prospect.name}
    Role: ${prospect.title}
    Company: ${prospect.company}

    JOB OPENING:
    Title: ${job.title}
    Description snippet: ${job.description.slice(0, 500)}...

    MY PROFILE:
    Skills: ${profile.skills.join(", ")}
    Experience Summary: ${profile.rawText.slice(0, 1000)}

    GUIDELINES:
    1. Keep it under 100 words.
    2. Focus on how I can help their team based on the job description.
    3. No generic fluff. Mention a specific skill or project that fits.
    4. Casual but professional tone.
    5. Signature should just be my name (from profile).
    6. Return JSON with 'subject' and 'body' fields.

    Return EXACTLY a JSON object:
    {
      "subject": "Quick question regarding [Job Title] role at [Company]",
      "body": "Hi [Name], ..."
    }
    `;

  try {
    const result = await callVertex(prompt)
    
    const cleanJson = result
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim()

    const raw = JSON.parse(cleanJson)
    return NextResponse.json(raw)
  } catch (err) {
    console.error("Vertex Outreach Generation Error:", err)
    return NextResponse.json({ error: "Failed to generate email" }, { status: 500 })
  }
}
