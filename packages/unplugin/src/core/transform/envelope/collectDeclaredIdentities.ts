import path from "node:path";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Fold one envelope member list (`volatile`, `dependenciesComplete`) into an
 * identity set. Members are keyed like `typescript`, so a project-relative and
 * an absolute spelling of the same file share one identity; a malformed member
 * is ignored rather than fatal.
 *
 * @evidence contracts/common.md#principled-implementation Valid declaration strings resolve against the project root before physical identity lookup, so absolute and relative aliases enter one membership set; malformed entries assert no membership.
 * @evidence contracts/common.md#clear-and-simple-design A single list-to-set adapter serves both volatility and completeness without duplicating their path identity policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Non-array values and empty or non-string members are rejected by protocol shape, not special-cased by consumer or expected output.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the shared declaration use, project-relative interpretation and malformed-entry handling; acknowledgment tags remain separated under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve interprets project-relative paths and the supplied envelope identity context handles filesystem case and realpath behavior without manually rewriting separators or guessing case by platform.
 * @evidence contracts/performance.md#efficient-algorithms One pass examines every declaration entry and a Set coalesces equal identities. Native path resolution and key hashing cost each valid spelling's length; derivationIdentity reuses the generation transaction and first misses pay native identity and case observations. Temporary storage follows distinct identities rather than repeated aliases.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Builds its Set once per call from its argument and keeps no cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The output Set is local and handed to the caller.
 */
export function collectDeclaredIdentities(
  state: TtscEnvelopeDerivation,
  projectRoot: string,
  listed: unknown,
): Set<string> {
  const output = new Set<string>();
  if (!Array.isArray(listed)) {
    return output;
  }
  for (const entry of listed) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    output.add(derivationIdentity(state, path.resolve(projectRoot, entry)));
  }
  return output;
}
