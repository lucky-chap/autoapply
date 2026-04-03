import { internalAction } from "../_generated/server";
import { v } from "convex/values";

const PDL_API_KEY = process.env.PDL_API_KEY;

export const searchPeople = internalAction({
  args: {
    company: v.string(),
    titles: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { company, titles, limit }) => {
    if (!PDL_API_KEY) {
      console.warn("PDL_API_KEY not set");
      return [];
    }

    const query = {
      query: {
        bool: {
          must: [
            { term: { "job_company_name": company.toLowerCase() } },
            { terms: { "job_title": titles.map(t => t.toLowerCase()) } },
            { exists: { field: "work_email" } }
          ]
        }
      },
      size: limit ?? 5,
    };

    const response = await fetch("https://api.peopledatalabs.com/v5/person/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": PDL_API_KEY,
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      console.error(`PDL API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const people = data.data || [];

    return people.map((p: any) => ({
      name: p.full_name,
      email: p.work_email,
      title: p.job_title,
      company: p.job_company_name || "",
      seniority: p.job_title_seniority,
      department: p.job_title_sub_role || "",
      source: "pdl",
      raw: p,
    }));
  },
});
