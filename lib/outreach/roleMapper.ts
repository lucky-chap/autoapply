/**
 * Maps a candidate's job title to the most likely hiring decision-maker role.
 */
export const ROLE_MAPPING: Record<string, string[]> = {
  "Software Engineer": ["Engineering Manager", "Director of Engineering", "CTO"],
  "Frontend Developer": ["Engineering Manager", "Head of Engineering", "CTO"],
  "Backend Developer": ["Engineering Manager", "Head of Engineering", "CTO"],
  "Full Stack Developer": ["Engineering Manager", "Head of Engineering", "CTO"],
  "Mobile Developer": ["Engineering Manager", "Head of Product", "CTO"],
  "Data Scientist": ["Head of Data", "VP of Engineering", "CTO"],
  "Product Designer": ["Head of Design", "Product Manager", "CEO"],
  "UX Designer": ["Head of Design", "Creative Director"],
  "Product Manager": ["Head of Product", "CEO", "COO"],
  "Marketing Manager": ["Head of Marketing", "CMO", "CEO"],
  "Sales Representative": ["Head of Sales", "VP of Sales", "CEO"],
  "Recruiter": ["Head of Talent", "HR Manager", "COO"],
};

export const DEFAULT_ROLES = ["CEO", "Founder", "Hiring Manager"];

/**
 * Infer the decision maker roles based on a job title.
 * @param jobTitle The title of the job opening.
 * @returns An array of target roles to search for.
 */
export function inferDecisionMakerRoles(jobTitle: string): string[] {
  // 1. Clean the title of common generic terms
  const genericTerms = ["remote", "eu", "us", "full-time", "part-time", "contract", "intern"];
  let cleanedTitle = jobTitle.toLowerCase();
  
  genericTerms.forEach(term => {
    cleanedTitle = cleanedTitle.replace(new RegExp(`\\b${term}\\b`, 'g'), "").trim();
  });

  // 2. Try specific mappings
  for (const [key, roles] of Object.entries(ROLE_MAPPING)) {
    if (cleanedTitle.includes(key.toLowerCase()) || jobTitle.toLowerCase().includes(key.toLowerCase())) {
      return roles;
    }
  }

  // 3. Fallback to defaults
  return DEFAULT_ROLES;
}
