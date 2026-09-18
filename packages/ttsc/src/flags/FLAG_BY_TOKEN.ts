import type { FlagSpec } from "./FlagSpec";
import { FLAG_SCHEMA } from "./FLAG_SCHEMA";
import { normalizeFlagToken } from "./normalizeFlagToken";

/**
 * Lookup of every declared spelling → its canonical FlagSpec, keyed by
 * {@link normalizeFlagToken}. Built once at module load so the parsing engine
 * has O(1) flag resolution. Prefer {@link resolveFlagSpec}, which applies the
 * normalization for the caller.
 */
export const FLAG_BY_TOKEN: ReadonlyMap<string, FlagSpec> = buildFlagIndex();

function buildFlagIndex(): ReadonlyMap<string, FlagSpec> {
  const index = new Map<string, FlagSpec>();
  for (const flag of FLAG_SCHEMA) {
    register(index, flag.name, flag);
    for (const alias of flag.aliases ?? []) {
      register(index, alias, flag);
    }
  }
  return index;
}

function register(
  index: Map<string, FlagSpec>,
  spelling: string,
  flag: FlagSpec,
): void {
  // Two spellings that normalize to one identity would make the schema
  // ambiguous, so the collision fails loudly at module load rather than
  // resolving to whichever row was declared last.
  const key = normalizeFlagToken(spelling);
  const existing = index.get(key);
  if (existing && existing !== flag) {
    throw new Error(
      `ttsc flag schema: duplicate token ${JSON.stringify(spelling)} claimed by ${existing.name} and ${flag.name}`,
    );
  }
  index.set(key, flag);
}
