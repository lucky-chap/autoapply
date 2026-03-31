import { tool } from "ai";
import { z } from "zod";
import { convex, api, getAuthenticatedUser } from "./_context";
import { callVertex } from "../vertex";

const parameters = z.object({
  company: z.string(),
  role: z.string(),
  jobDescription: z.string().optional(),
});

export const generateCoverLetterTool = tool({
  description: "Generate a personalized cover letter based on user resume and job details.",
  parameters: parameters as any,
  execute: async ({ company, role, jobDescription }: any) => {
    const user = await getAuthenticatedUser();
    const resume = await convex.query(api.resumeProfiles.getByUser, { userId: user.sub });
    
    if (!resume) {
      return "Error: No resume profile found. Please upload your resume first.";
    }

    const prompt = `
      Generate a professional and concise cover letter for the following job:
      Company: ${company}
      Role: ${role}
      ${jobDescription ? `Job Description: ${jobDescription}` : ""}

      User Background:
      Experience: ${JSON.stringify(resume.experience)}
      Skills: ${resume.skills.join(", ")}
      Tone: ${resume.tone}

      The cover letter should be ready to send, emphasizing the user's fit for the specific role based on their background.
    `;
    
    const coverLetter = await callVertex(prompt);
    return { coverLetter };
  },
} as any);
