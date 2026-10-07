import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/**
 * Attempt one warning per native resolved spelling and generation when a module
 * arrives with text that differs from the file it names.
 *
 * The spelling is recorded before stderr is written, so a synchronous write
 * failure propagates but does not authorize another attempt for that key.
 * Physical aliases remain separate warning keys; this reporting set does not
 * decide compiler input identity or generation freshness.
 *
 * Ttsc compiles the whole project from disk, so the delivered text never
 * reaches the output: the module is served from the compile of the file on
 * disk. That is right when the host read the file just before it changed, and
 * the host's next delivery resolves it. It is wrong when a plugin ordered
 * before ttsc rewrote the module, because that rewrite is then dropped, so the
 * report names the likely cause instead of letting the rewrite vanish
 * silently.
 *
 * @evidence contracts/common.md#principled-implementation A generation-owned set suppresses repeated warning attempts for the same native resolved spelling while the message distinguishes delivered text from the disk program. Recording precedes writing, independently of stream success or backpressure.
 * @evidence contracts/common.md#clear-and-simple-design One membership check and one stderr message own the warning; compilation and delivery policy remain outside reporting.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Divergence is exposed rather than hidden by returning the host's uncompiled text or rewriting expected module output.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the disk-compilation premise, rewrite causes, lexical suppression scope and pre-write recording rather than promising successful output.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node native resolve and relative choose the displayed address, including
 *   native cross-root behavior. Splitting native separators and joining with /
 *   is presentation only, not a guarantee of equal paths across filesystems.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Native resolution and set-key lookup cost path text. An unsuppressed report
 *   also computes a relative address, allocates split/join and message strings,
 *   then writes their bytes to stderr; repeated keys return before those steps.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The per-generation set suppresses repeated message construction and write
 *   attempts for the same resolved spelling, not every physical alias.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The generation-owned set grows with distinct divergent spelling keys and
 *   their text, then becomes collectible with the generation. Native stderr
 *   owns stream buffering/backpressure; this reporter retains no separate task.
 */
export function reportDivergentDelivery(
  /** Generation owning warning suppression and the diagnostic root. */
  cached: TtscCachedProjectTransform,
  /** Native source spelling normalized only for suppression and display. */
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
