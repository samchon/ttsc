import fs from "node:fs";

/**
 * Remove the scratch directory of one whole-project capture, retrying while a
 * process still holds it.
 *
 * Windows refuses to remove a directory a process holds, its working directory
 * or a file an indexer or a just-exiting plugin child has open, and the refusal
 * ends once the holder lets go. The removal is asynchronous because Node
 * retries only an asynchronous removal: `rmSync` ignores `maxRetries`, so a
 * transient hold failed a capture whose compile had succeeded. Up to ten
 * retries are made, each one 100 ms after the last. A hold that outlasts them
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
 * @evidence contracts/common.md#clear-and-simple-design One call states the retry policy for the capture's scratch removal; the optional operation exists only so that policy can be observed without a locked directory, and the capture keeps ownership of when and in what order cleanup runs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The default operation is the native removal and a failure is never swallowed; injection is a parameter at this boundary rather than a replaced fs method, and no error is retried beyond the bound or masked as success.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why the removal is asynchronous, the retry bound and the effect of a persistent failure, followed by parameter documentation and separated tags under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The retry addresses Windows' refusal to remove a held directory; on other platforms the first attempt succeeds, so nothing is assumed from the operating system name.
 * @evidence contracts/performance.md#efficient-algorithms One recursive removal visits the scratch tree once, plus at most ten bounded retries whose delay is fixed rather than growing with the tree.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A removal is an effect on one capture's own directory; no completed computation is shared across requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The directory is released after at most ten bounded retries and nothing is retained afterwards; a hold that outlasts them leaves the directory and reports the failure.
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
