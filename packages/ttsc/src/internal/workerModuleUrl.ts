import path from "node:path";

/**
 * Load an owned CommonJS worker through a module URL while retaining Node's
 * inherited execution options and preload hooks.
 *
 * A parent launched with --input-type interprets stdin or evaluated source.
 * With a preload, module resolution rejects that inherited option at a file
 * worker entry before the worker can start. A supported data URL supplies
 * module source that requires the real entry. Setting execArgv instead would
 * replace Node's inherited-option handling and can reject otherwise valid
 * process options such as --max-old-space-size. createRequire preserves the
 * entry's CommonJS resolution, including literal POSIX backslashes that file
 * URL imports reject as encoded separators. The worker entry must use the
 * package's CommonJS source or emitted format.
 *
 * @param filename Native entry path, resolved from cwd when relative.
 * @returns A data URL accepted by the Worker constructor; it owns no thread.
 * @evidence contracts/common.md#principled-implementation Node documents data URL worker entries and inherited options; a module-source entry requires the selected CommonJS owner without applying the parent's stdin-only input type to that file's initial module resolution.
 * @evidence contracts/common.md#clear-and-simple-design One URL constructor owns the bootstrap representation while callers retain worker options, thread lifetime and actual entry selection.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported createRequire loads the actual CommonJS owner; no flags are guessed, stripped or replaced and no foreign process state is changed.
 * @evidence contracts/common.md#meaningful-documentation Prose explains the stdin inheritance failure, the explicit-execArgv hazard, CommonJS entry requirements and the native path input.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and createRequire retain filesystem path spelling, including POSIX literal backslashes; JSON string encoding and data URL encoding separate that path from JavaScript and URL syntax without routing it through ESM file-URL separator rules.
 * @evidence contracts/performance.md#efficient-algorithms Native path resolution, string encoding and data URL construction each visit entry-path text; the returned URL and its module source occupy linear space in that text.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call represents its selected entry and retains no computed answer.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This operation returns a URL without acquiring a worker, file handle or persistent state; the caller owns the URL and thread.
 * @see https://nodejs.org/api/worker_threads.html#new-workerfilename-options
 * @see https://nodejs.org/api/cli.html#--input-typetype
 */
export function workerModuleUrl(filename: string): URL {
  const entry = JSON.stringify(path.resolve(filename));
  const source = `import { createRequire } from "node:module"; createRequire(${entry})(${entry});`;
  return new URL(`data:text/javascript,${encodeURIComponent(source)}`);
}
