import { tool } from "ai";
import { z } from "zod";
import { callVertex } from "../vertex";

const parameters = z.object({
  text: z.string().describe("The job description or posting text to parse"),
});

export const extractJobInfoTool = tool({
  description: "Extract company, role, and recruiter email from a job description or posting text.",
  parameters: parameters as any,
  execute: async ({ text }: any) => {
    const prompt = `
      Extract the following information from this job description:
      - Company Name
      - Job Role/Title
      - Recruiter or Contact Email (if found)

      Format your response as a JSON object with keys: "company", "role", "email".
      If you can't find a field, use null.
      
      Job Description:
      """
      ${text}
      """
    `;
    const response = await callVertex(prompt);
    try {
      const jsonStr = response.match(/\{[\s\S]*\}/)?.[0] || response;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse GLM response as JSON:", response);
      return { company: null, role: null, email: null, raw: response };
    }
  },
} as any);
