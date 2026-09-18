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
