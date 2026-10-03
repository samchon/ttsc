import fs from "node:fs";

/**
 * Remove the scratch directory of one whole-project capture, retrying while a
 * process still holds it.
 *
 * Windows refuses to remove a directory a process holds, its working directory
 * or a file an indexer or a just-exiting plugin child has open, and the refusal
 * can end once the holder lets go. The asynchronous operation avoids blocking
 * the event loop during native removal and retry delays; synchronous removal
 * also supports recursive retry options. Node retries supported busy/resource/
 * permission errors with linear backoff, increasing delay by 100 ms per try,
 * with maxRetries=10. A failure that outlasts the policy
 * is a real failure and propagates to the caller, which decides whether it may
 * replace an earlier error.
 *
 * The removal operation is a parameter so a caller can observe the retry
 * request without a real locked directory. It must behave as `fs.promises.rm`
 * does: resolve once the directory is gone, reject with the native error
 * otherwise.
 *
 * @param directory The adapter-owned scratch directory the capture created.
 * @param remove The removal operation; the native one by default.
 *
 * @evidence contracts/common.md#principled-implementation An asynchronous recursive removal with Node's retry options is the supported way to outlast a transient Windows hold, while a persistent failure is propagated instead of being reported as removed.
 * @evidence contracts/common.md#clear-and-simple-design One awaited call states the scratch-removal policy; the supported operation parameter permits observation or alternate caller behavior, while capture owns cleanup timing/order and the supplied operation owns actual retry execution.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The default operation is the native removal and a failure is never swallowed; injection is a parameter at this boundary rather than a replaced fs method, and no error is retried beyond the bound or masked as success.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why the removal is asynchronous, the retry bound and the effect of a persistent failure, followed by parameter documentation and separated tags under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node recursive removal receives the native scratch path and handles supported EBUSY, EMFILE, ENFILE, ENOTEMPTY and EPERM retry conditions. Windows holds are one cause; no OS name guarantees first-attempt success or release behavior.
 * @evidence contracts/performance.md#efficient-algorithms The native operation owns traversal and retries over the scratch subtree, so visited descendants, native errors and retried operations drive work/storage. maxRetries=10 bounds supported retry counts, with linear delay increments of 100 ms; it does not prove one visit per descendant or a global wall-time/tree-work bound. A supplied operation must implement the same requested policy to provide those retry semantics.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A removal is an effect on one capture's own directory; no completed computation is shared across requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This call waits for native recursive removal or rejection, and retains no historical cache or observer. Rejection can leave a partially removed tree; the capture owner decides subsequent error/cleanup handling. Supported retry count does not bound pending native IO duration or guarantee release, and injected operations own their actual task lifetime.
 */
export async function removeCaptureScratch(
  directory: string,
  remove: typeof fs.promises.rm = fs.promises.rm,
): Promise<void> {
  await remove(directory, {
    force: true,
    maxRetries: 10,
    recursive: true,
    retryDelay: 100,
  });
}
