import { internalAction } from "../_generated/server";
import { v } from "convex/values";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

export const searchPeople = internalAction({
  args: {
    company_domain: v.string(),
    titles: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { company_domain, titles, limit }) => {
    if (!APOLLO_API_KEY) {
      console.warn("APOLLO_API_KEY not set");
      return [];
    }

    // Use mixed_people/api_search as another variant
    const response = await fetch("https://api.apollo.io/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        q_organization_domains: company_domain,
      }),
    });

    if (!response.ok) {
      console.error(`Apollo API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Apollo error details: ${errorText}`);
      return [];
    }

    const data = await response.json();
    console.log(`Apollo returned ${data.people?.length || 0} people for ${company_domain}`);
    const people = data.people || [];

    // Filter by titles locally to find relevant hiring managers
    const lowerTitles = titles.map(t => t.toLowerCase());
    const matchedPeople = people.filter((p: any) => {
      const pTitle = (p.title || "").toLowerCase();
      return lowerTitles.some(t => pTitle.includes(t));
    });

    // If no strong matches, return the top few people anyway as fallback
    const results = matchedPeople.length > 0 ? matchedPeople : people.slice(0, 3);

    return results.map((p: any) => ({
      name: p.name,
      email: p.email,
      title: p.title,
      company: p.organization?.name || "",
      seniority: p.seniority,
      department: p.departments?.[0] || "",
      source: "apollo",
      raw: p,
    }));
  },
});
