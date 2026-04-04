/**
 * Generate common hiring email addresses from a company domain.
 * Used as a last-resort fallback when enrichment APIs return nothing.
 */
export function generateHiringEmails(domain: string): string[] {
  if (!domain) return []
  return [
    `careers@${domain}`,
    `jobs@${domain}`,
    `hiring@${domain}`,
    `hr@${domain}`,
    `apply@${domain}`,
  ]
}
