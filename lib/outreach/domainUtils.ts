/**
 * Extracts a clean domain from a URL or company name.
 * Handles cases like https://goareo.com/ -> goareo.com
 */
export function extractDomain(url?: string, companyName?: string): string {
  if (url) {
    try {
      const parsed = new URL(url);
      let domain = parsed.hostname.replace(/^www\./, "");
      if (domain) return domain;
    } catch (e) {
      // If URL parsing fails, try manual extraction
      const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
      if (match?.[1]) return match[1];
    }
  }

  if (companyName) {
    // Basic fallback: lowercase, no spaces + .com
    return companyName.toLowerCase().replace(/\s+/g, "") + ".com";
  }

  return "";
}
