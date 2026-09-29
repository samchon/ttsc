import type fs from "node:fs";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { normalizeHostInputName } from "../filesystem/normalizeHostInputName";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";

/**
 * Prove the universal inputs that were absent are still absent, through one
 * exact listing of the nearest directory that can settle it.
 *
 * Unlike the entries half, this one rejects on an inability to prove: a
 * directory that exists but cannot be listed certifies nothing about the
 * candidates inside it. That is the right answer for the narrow path, which has
 * no stronger proof to fall back to, but not for the whole-snapshot path, where
 * the recorded `missing` markers are re-compared directly and losing a proof
 * must not cost the cache.
 *
 * @evidence contracts/common.md#principled-implementation Exact nearest-directory listings prove missing names only when listing succeeds or an absent/non-directory ancestor proves traversal impossible; permission failure supplies no absence proof.
 * @evidence contracts/common.md#clear-and-simple-design Missing-name validation has its own boolean boundary, leaving the complete snapshot caller to use stronger recorded-state fallback.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable directories are never treated as empty listings; only ENOENT and ENOTDIR establish inaccessible path absence.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain inability-to-prove rejection and the narrower caller contract before tags.
 * @evidence contracts/performance.md#efficient-algorithms Missing paths are grouped by nearest directory, so one listing and name-set membership checks serve all candidates in that group; cost grows with listed entries.
 * @evidence contracts/performance.md#reuse-equivalent-work The generation manifest shares grouped absence observations across module consumers rather than independently probing every ancestor chain.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This pass borrows the manifest and holds only one temporary directory listing at a time; the generation owns retained groups.
 * @evidence contracts/portability.md#os-neutral-implementation Directory operations use the injected native filesystem and measured per-directory case policy; unavailable case observations decline listing-only proof rather than inventing a platform-wide casing rule.
 */
export function matchesUniversalHostInputProbes(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
): boolean {
  const filesystem = resultFilesystem(cached.result);
  for (const [directory, names] of validation.missing) {
    let entries: fs.Dirent[];
    try {
      entries = filesystem.readdir(directory);
    } catch (error) {
      // Only a provably absent/non-directory ancestor keeps every descendant
      // unreachable. Permission and transient I/O failures cannot prove that
      // a candidate is still missing, while replacing the proving directory
      // with an exact file can itself redirect module resolution.
      try {
        if (!filesystem.stat(directory).isDirectory()) return false;
      } catch (statError) {
        if (!isMissingPathError(statError)) return false;
        continue;
      }
      return false;
    }
    const identities = envelopeDerivation(cached).identityContext;
    const caseSensitive = identities.caseSensitive(directory);
    if (caseSensitive === undefined) return false;
    if (
      entries.some((entry) =>
        names.has(normalizeHostInputName(entry.name, caseSensitive)),
      )
    ) {
      return false;
    }
  }
  return true;
}

/** True only for errors that prove a path cannot currently be traversed. */
function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}
