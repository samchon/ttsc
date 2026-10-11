import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
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
 * @evidence contracts/common.md#principled-implementation Exact native ENOENT or ENOTDIR observations prove an exact path absent, including native Unicode and short-name aliases. A grouped candidate accepts ENOENT alone, which holds whether its directory stayed or vanished and left it unreachable; its ENOTDIR means the directory became a non-directory and rejects the proof.
 * @evidence contracts/common.md#clear-and-simple-design Missing-name validation has its own native absence boundary shared by narrow and complete proof; byte hashes and project membership remain separate predicates.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Listing inequality is not native name inequality; permission and transient failures are not fabricated absence. Only ENOENT and ENOTDIR qualify exact missing paths, and only ENOENT a grouped candidate.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain inability-to-prove rejection, unreadable-content ambiguity and both caller routes before tags.
 * @evidence contracts/portability.md#os-neutral-implementation The injected native stat resolves original candidate spelling, and its platform selects the same win32 or posix joining grammar as capture's ancestor probe. Case flags and JavaScript Unicode folding do not replace native alias resolution.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The pass borrows generation-owned groups and retains only each current native probe result; no directory listing, historical state or handle is acquired.
 * @evidence contracts/performance.md#efficient-algorithms Each candidate requires one native stat, whose result also answers for its directory, so the directory the tracker already verified is not stated again. Work follows candidate count and native path resolution, without enumerating unrelated directory entries; exact probes are necessary because listing names cannot establish all native aliases.
 * @evidence contracts/performance.md#reuse-equivalent-work Capture shares nearest-ancestor selection and raw candidate groups across consumers; each current absence proof must observe native candidates again unless the owning notification validator establishes unchanged inputs.
 */
export function matchesUniversalHostInputProbes(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
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
    // Each candidate is the first missing component directly below its
    // directory, so its own stat also answers for the directory: ENOENT holds
    // whether the directory stayed or vanished, which keeps every descendant
    // unreachable, while ENOTDIR means the directory was replaced by a
    // non-directory, which can itself redirect module resolution. The tracker
    // already states the directory once per delivery to verify its identity;
    // a second stat here only repeated it.
    for (const name of names) {
      try {
        filesystem.stat(paths.join(directory, name));
        return false;
      } catch (error) {
        // Permission and transient I/O failures cannot prove the candidate is
        // still missing.
        if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT")
          return false;
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
