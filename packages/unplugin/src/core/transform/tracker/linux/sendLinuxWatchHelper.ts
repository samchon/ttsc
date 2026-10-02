import type { LinuxWatchHelper } from "./LinuxWatchHelper";

/**
 * Write one request line to the Linux watch helper, and report whether it could
 * be written (samchon/ttsc#1426).
 *
 * A false stream-write return denotes backpressure after queuing, not failed
 * submission. Only an unavailable stream or thrown write withdraws submission.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Newline-delimited JSON carries the helper protocol. Stream availability
 *   and exceptions determine submission, preserving Node's backpressure meaning.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One serialization boundary handles add, remove and sync uniformly;
 *   acknowledgment and request lifetime remain with callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The function does not invent an acknowledgment from write success or
 *   conflate a queued request with a helper-confirmed observation.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs distinguish submission from backpressure and later
 *   acknowledgment, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral protocol transport uses child stdin and JSON framing rather
 *   than shell syntax, native separators or filesystem case assumptions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Writes one line to the helper's stdin; the request's lifetime belongs to its caller.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One write of one JSON line.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A request is an effect; its answer is awaited by the caller.
 */
export function sendLinuxWatchHelper(
  helper: LinuxWatchHelper,
  request: { id: number; op: "add" | "remove" | "sync"; path?: string },
): boolean {
  const input = helper.child.stdin;
  if (input === null || input.destroyed || !input.writable) return false;
  try {
    input.write(`${JSON.stringify(request)}\n`);
    return true;
  } catch {
    return false;
  }
}
