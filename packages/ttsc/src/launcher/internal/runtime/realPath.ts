import fs from "node:fs";

/**
 * Best-effort physical lookup using the launcher's native realpath preference.
 *
 * Prefer `realpathSync.native`, falling back to the ordinary API only when the
 * native entry point is unavailable. Using the same lookup preference aligns
 * successful link and short-name observations rather than manufacturing a
 * second spelling policy; separate queries still observe their current paths.
 *
 * On a failed lookup the input is retained. That fallback is a serving or
 * lookup spelling, not proven authority for recursive cleanup.
 *
 * @evidence contracts/common.md#principled-implementation Successful native realpath aligns hook paths with launcher identity, including Windows short names; failed resolution explicitly preserves the input without claiming physical identity.
 * @evidence contracts/common.md#clear-and-simple-design One best-effort resolver shares the runtime's successful-path spelling rule and keeps cleanup's stricter ownership boundary elsewhere.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No OS-label case folding or path-name exception substitutes for filesystem resolution; the documented unresolved fallback does not authorize deletion.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain native short-name normalization and the limit of failed resolution, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation fs.realpathSync.native resolves native links and Windows 8.3 spelling; the ordinary API fallback preserves supported hosts without assuming a universal filesystem case rule.
 * @evidence contracts/performance.md#efficient-algorithms One realpath request avoids an explicit directory-wide source search, but native path/text/link resolution and latency are not bounded by that call count. Caught failure returns the supplied spelling without an additional probe.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Links and paths may change; this lookup owns no stable invalidation identity and does not cache a previous filesystem result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous path query retains no descriptor, task or historical mapping.
 */
export function realPath(target: string): string {
  try {
    return fs.realpathSync.native?.(target) ?? fs.realpathSync(target);
  } catch {
    return target;
  }
}
