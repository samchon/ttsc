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
 */
export function resolveFlagSpec(token: string): FlagSpec | undefined {
  if (!token.startsWith("-")) return undefined;
  const equalsIndex = token.indexOf("=");
  const name = equalsIndex === -1 ? token : token.slice(0, equalsIndex);
  return FLAG_BY_TOKEN.get(normalizeFlagToken(name));
}
