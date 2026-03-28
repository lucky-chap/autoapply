/** Strip HTML tags and decode common entities. Preserves paragraph breaks as newlines. */
export function stripHtml(html: string): string {
  return html
    .replace(/<\s*\/?\s*p\s*\/?>/gi, "\n") // <p> and </p> → newline
    .replace(/<\s*br\s*\/?>/gi, "\n")       // <br> → newline
    .replace(/<[^>]*>/g, " ")               // all other tags → space
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/[^\S\n]+/g, " ")             // collapse spaces but keep newlines
    .replace(/\n\s*\n/g, "\n")             // collapse multiple blank lines
    .trim()
}

/** Common noise addresses to ignore */
const NOISE_PATTERNS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^support@/i,
  /^example@/i,
  /@example\.com$/i,
  /@sentry\.io$/i,
  /\.(png|jpg|jpeg|gif|svg|webp)$/i,
]

/** Keywords near an email that suggest it's the apply address */
const APPLY_KEYWORDS = /apply|send|resume|cv|contact|hiring|jobs?|career/i

/**
 * Normalize obfuscated emails in text so the standard regex can find them.
 * Handles patterns like:
 *   vance [at] blackbird.us  →  vance@blackbird.us
 *   jobs -- at -- kyber.media  →  jobs@kyber.media
 *   alexander [at] hatchet [dot] run  →  alexander@hatchet.run
 *   foo (at) bar (dot) com  →  foo@bar.com
 *   foo{at}bar{dot}com  →  foo@bar.com
 */
function deobfuscateEmails(text: string): string {
  return text
    // Normalize "at" variants → @  (requires at least one delimiter/bracket around "at")
    .replace(/\s*[\[({<–—]+\s*at\s*[\])}>–—]*\s*/gi, "@")
    .replace(/\s*[\[({<–—]*\s*at\s*[\])}>–—]+\s*/gi, "@")
    .replace(/\s+--?\s*at\s*--?\s+/gi, "@")
    // Normalize "dot" variants → .  (requires at least one delimiter/bracket around "dot")
    .replace(/\s*[\[({<–—]+\s*dot\s*[\])}>–—]*\s*/gi, ".")
    .replace(/\s*[\[({<–—]*\s*dot\s*[\])}>–—]+\s*/gi, ".")
    .replace(/\s+--?\s*dot\s*--?\s+/gi, ".")
}

/**
 * Extract the best recruiter/contact email from text using regex.
 * Handles obfuscated emails (e.g. "name [at] company [dot] com").
 * Filters out noise addresses and prefers emails near apply-related keywords.
 * Returns null if no valid email found.
 */
export function extractEmail(text: string): string | null {
  // Try both the original text and a deobfuscated version
  const normalized = deobfuscateEmails(text)
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const allEmails = [
    ...(text.match(emailPattern) ?? []),
    ...(normalized.match(emailPattern) ?? []),
  ]

  if (!allEmails || allEmails.length === 0) return null

  // Deduplicate and filter noise
  const unique = [...new Set(allEmails.map((e) => e.toLowerCase()))]
  const valid = unique.filter(
    (email) => !NOISE_PATTERNS.some((p) => p.test(email))
  )

  if (valid.length === 0) return null
  if (valid.length === 1) return valid[0]

  // Prefer emails that appear near apply-related keywords
  for (const email of valid) {
    const idx = text.toLowerCase().indexOf(email)
    // Check 80 chars before and after the email for keywords
    const surrounding = text
      .slice(Math.max(0, idx - 80), idx + email.length + 80)
      .toLowerCase()
    if (APPLY_KEYWORDS.test(surrounding)) {
      return email
    }
  }

  // Default to first valid email
  return valid[0]
}

/**
 * Extract a URL from text. Returns the first http/https URL found, or null.
 */
export function extractUrl(text: string): string | null {
  const urlPattern = /https?:\/\/[^\s<>"']+/g
  const match = text.match(urlPattern)
  return match?.[0] ?? null
}
