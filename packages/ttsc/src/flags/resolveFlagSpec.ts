import { FLAG_BY_TOKEN } from "./FLAG_BY_TOKEN";
import type { FlagSpec } from "./FlagSpec";
import { normalizeFlagToken } from "./normalizeFlagToken";

/**
 * Resolve a raw argv token to the flag it names, or `undefined` when the schema
 * claims no such flag.
 *
 * Accepts every spelling the compiler accepts — any casing, one or two leading
 * dashes — plus the inline `--flag=value` form, whose value is not part of the
 * identity. A token without a leading dash is never a flag: bare tokens are
 * input files and flag values, and resolving them here would let a value like
 * the `all` of `--target all` masquerade as `--all`.
 *
 * @evidence contracts/common.md#principled-implementation Requiring a leading dash distinguishes option tokens from values; splitting at the first equals sign and normalizing only the name yields the canonical schema identity while preserving value spelling for its owner.
 * @evidence contracts/common.md#clear-and-simple-design This resolver owns raw-token classification and delegates spelling policy to normalizeFlagToken and lookup storage to FLAG_BY_TOKEN.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The dash guard follows argv grammar rather than compensating with a list of positional names that happen to collide with options.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain undefined results, inline-value separation and why bare values are rejected, applying the documentation skill's failure-state and rationale guidance.
 */
export function resolveFlagSpec(token: string): FlagSpec | undefined {
  if (!token.startsWith("-")) return undefined;
  const equalsIndex = token.indexOf("=");
  const name = equalsIndex === -1 ? token : token.slice(0, equalsIndex);
  return FLAG_BY_TOKEN.get(normalizeFlagToken(name));
}
