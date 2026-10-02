import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/**
 * Tell the user once per file and generation that a module reached ttsc with
 * text that differs from the file it names (samchon/ttsc#1394).
 *
 * Ttsc compiles the whole project from disk, so the delivered text never
 * reaches the output: the module is served from the compile of the file on
 * disk. That is right when the host read the file just before it changed, and
 * the host's next delivery resolves it. It is wrong when a plugin ordered
 * before ttsc rewrote the module, because that rewrite is then dropped, so the
 * report names the likely cause instead of letting the rewrite vanish
 * silently.
 *
 * @evidence contracts/common.md#principled-implementation A generation-owned set suppresses repeated reports for the same resolved module while the message accurately distinguishes delivered text from the disk program being compiled.
 * @evidence contracts/common.md#clear-and-simple-design One membership check and one stderr message own the warning; compilation and delivery policy remain outside reporting.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Divergence is exposed rather than hidden by returning the host's uncompiled text or rewriting expected module output.
 * @evidence contracts/common.md#meaningful-documentation The native prose explains the disk-compilation premise and the differing causes of stale delivery and an earlier rewriting plugin.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Splits the relative name on path.sep and joins it with /, so the reported
 *   name is the same on every OS.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The per-transform reported set makes each file warn once.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The reported set lives on the cached transform, holds one path per
 *   divergent file and is released with it.
 */
export function reportDivergentDelivery(
  cached: TtscCachedProjectTransform,
  file: string,
): void {
  const reported = (cached.divergentDeliveryReported ??= new Set<string>());
  const key = path.resolve(file);
  if (reported.has(key)) return;
  reported.add(key);
  const name = path.relative(cached.projectRoot, key).split(path.sep).join("/");
  process.stderr.write(
    `ttsc: ${name} reached ttsc with text that differs from the file on disk. ` +
      "ttsc transforms the file as it is on disk, so the delivered text was " +
      "not used. If another plugin rewrites this module, order it after ttsc " +
      '(ttsc runs with enforce: "pre").\n',
  );
}
