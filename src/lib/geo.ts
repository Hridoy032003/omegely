/**
 * Best-effort country detection with zero external dependencies and no database.
 *
 * On Vercel every request carries `x-vercel-ip-country`, resolved at the edge —
 * we just read it. Behind other CDNs the equivalent header is used; locally
 * (where none exist) we fall back to the browser's Accept-Language region hint
 * (e.g. `en-US` -> `US`).
 *
 * Returns an ISO 3166-1 alpha-2 code, or "XX" when unknown.
 */
const CDN_COUNTRY_HEADERS = [
  "x-vercel-ip-country", // Vercel
  "cf-ipcountry", // Cloudflare
  "x-country-code", // Fastly / generic
  "x-appengine-country", // Google App Engine
  "fastly-geo-country",
] as const;

export function resolveCountry(headers: Headers): string {
  for (const name of CDN_COUNTRY_HEADERS) {
    const code = headers.get(name);
    if (code && /^[A-Za-z]{2}$/.test(code) && code.toUpperCase() !== "XX") {
      return code.toUpperCase();
    }
  }

  const lang = headers.get("accept-language");
  if (lang) {
    const match = lang.match(/[a-z]{2}-([A-Z]{2})/);
    if (match) return match[1].toUpperCase();
  }

  return "XX";
}
