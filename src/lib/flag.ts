/** Turn an ISO 3166-1 alpha-2 code into its emoji flag. "XX"/unknown -> 🌍. */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2 || code.toUpperCase() === "XX") return "🌍";
  const base = 127397; // 0x1F1E6 - 'A'.charCodeAt(0)
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => base + c.charCodeAt(0)),
  );
}
