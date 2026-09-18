/**
 * Normalize a CLI token to the identity the compiler ttsc wraps resolves it by:
 * one or two leading dashes removed, the remainder lower-cased.
 *
 * TypeScript's option parser — legacy `tsc` and native tsgo alike — strips a
 * `--` or `-` prefix and matches the rest case-insensitively, so `--noEmit`,
 * `--noemit`, `--NOEMIT`, and `-noEmit` all name the same option to the tool
 * ttsc forwards to. The launcher used to key its index on the exact spelling,
 * so a case variant of a ttsc-owned flag fell through the unknown-flag escape
 * hatch: tsgo honoured it and every ttsc-side consumer of the same flag never
 * fired, with no diagnostic.
 *
 * This is the single normalization. Everything that resolves a token against
 * `FLAG_SCHEMA` — the parsing engine, the terminal / shadow / project-free
 * classifications, and the generated Go allow-lists — keys off this function,
 * so no two layers can disagree about which flag a spelling names.
 */
export function normalizeFlagToken(token: string): string {
  return token.replace(/^--?/, "").toLowerCase();
}
