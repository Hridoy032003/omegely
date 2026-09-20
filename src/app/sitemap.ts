import type { MetadataRoute } from "next";

const SITE_URL = "https://www.omegley.in";
const LAST_MODIFIED = new Date("2026-09-20T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/chat`, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/guidelines`, lastModified: LAST_MODIFIED, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/cookies`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
