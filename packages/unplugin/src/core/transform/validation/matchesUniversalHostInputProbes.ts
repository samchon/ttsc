import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import type { TtscGenerationProof } from "./TtscGenerationProof";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";

/**
 * Prove the universal inputs that were absent are still absent, through one
 * native stat of the requested candidate. Groups retain the first missing
 * component beneath the nearest directory; unqualified inputs retain their full
 * exact paths.
 *
 * Unlike the entries half, this one rejects on an inability to prove: a
 * permission or I/O failure certifies nothing about absence. That is the right
 * answer for both narrow and complete proof: a recorded unavailable-content
 * marker alone cannot distinguish absence from a newly present unreadable file.
 * Complete validation still compares its recorded byte and membership
 * populations after this independent native absence predicate holds.
 *
 * A group also needs its directory to still be one, which a candidate's own
 * stat cannot say: Windows answers ENOENT below a file just as below nothing.
 * The admission's location verification has already read that of every watched
 * directory, so a group under one reuses it instead of stating the directory a
 * second time in the same delivery (samchon/ttsc#1735).
 *
 * @evidence contracts/common.md#principled-implementation Exact native ENOENT or ENOTDIR observations prove candidate absence, including native Unicode and short-name aliases. A vanished ancestor leaves descendants unreachable; replacement by a file rejects the grouped directory proof, whether this pass or the admission's location verification observed the directory.
 * @evidence contracts/common.md#clear-and-simple-design Missing-name validation has its own native absence boundary shared by narrow and complete proof; byte hashes and project membership remain separate predicates.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Listing inequality is not native name inequality; permission and transient failures are not fabricated absence. Only ENOENT and ENOTDIR qualify missing-path observations, and only an identity read by the same synchronous admission stands for a directory stat.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain inability-to-prove rejection, unreadable-content ambiguity, both caller routes and the shared directory reading before tags.
 * @evidence contracts/portability.md#os-neutral-implementation The injected native stat resolves original candidate spelling, and its platform selects the same win32 or posix joining grammar as capture's ancestor probe. Case flags and JavaScript Unicode folding do not replace native alias resolution, and the directory check does not rely on ENOTDIR, which Windows does not report.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The pass borrows generation-owned groups and the admission's identities, and retains only each current native probe result; no directory listing, historical state or handle is acquired.
 * @evidence contracts/performance.md#efficient-algorithms Each candidate requires one native stat, and each group one directory stat unless its admission already read the directory's identity. Work follows candidate count and native path resolution, without enumerating unrelated directory entries; exact probes are necessary because listing names cannot establish all native aliases.
 * @evidence contracts/performance.md#reuse-equivalent-work Capture shares nearest-ancestor selection and raw candidate groups across consumers, and one synchronous admission shares its watched directories' identities; each current absence proof must observe native candidates again unless the owning notification validator establishes unchanged inputs.
 */
export function matchesUniversalHostInputProbes(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
  proof?: TtscGenerationProof.Transaction,
): boolean {
  const filesystem = resultFilesystem(cached.result);
  const paths =
    (filesystem.platform ?? process.platform) === "win32"
      ? path.win32
      : path.posix;
  for (const input of validation.directMissing ?? []) {
    try {
      filesystem.stat(input);
      return false;
    } catch (error) {
      if (!isMissingPathError(error)) return false;
    }
  }
  for (const [directory, names] of validation.missing) {
    // An identity the admission read proves the directory is one now.
    if (proof?.locations?.get(directory) === undefined) {
      try {
        if (!filesystem.stat(directory).isDirectory()) return false;
      } catch (error) {
        // Only a provably absent/non-directory ancestor keeps every descendant
        // unreachable. Permission and transient I/O failures cannot prove that
        // a candidate is still missing, while replacing the proving directory
        // with an exact file can itself redirect module resolution.
        if (!isMissingPathError(error)) return false;
        continue;
      }
    }
    for (const name of names) {
      try {
        filesystem.stat(paths.join(directory, name));
        return false;
      } catch (error) {
        if (!isMissingPathError(error)) return false;
      }
    }
  }
  return true;
}

/** True only for errors that prove a path cannot currently be traversed. */
function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}
