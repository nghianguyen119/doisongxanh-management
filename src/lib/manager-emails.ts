/**
 * Parse the comma-separated manager allowlist.
 *
 * Values pasted into hosting dashboards often keep the quotes from a `.env`
 * file (`"a@b.com,c@d.com"`), which would never match a real email address.
 * Strip surrounding quotes/whitespace, lowercase, and drop empty entries.
 */
export function parseManagerEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim().replace(/^["']+|["']+$/g, "").trim().toLowerCase())
    .filter(Boolean)
}
