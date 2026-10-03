import fs from "node:fs";

/**
 * Whether a path currently resolves to a regular file.
 *
 * Any failure to stat returns false, meaning the candidate is not proven to
 * be a regular file. Nested project-reference selection skips such candidates
 * but keeps them consulted; a successful stat does not prove config readability.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Link-following stat must prove a regular file; an unobservable candidate
 *   cannot satisfy selection's file-kind predicate.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns one best-effort kind question, leaving path selection and
 *   compiler diagnostics to their callers.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node stat observes native file kind and follows links. Every unproven
 *   observation is false without guessing from filename spelling or OS name.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Failed stat does not become assumed presence or a special known config.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Purpose and failure-policy paragraphs explain why every stat failure returns
 *   false instead of claiming a missing file was the only possible error.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One synchronous stat follows native path components and links before a
 *   fixed file-kind predicate. Path spelling and native lookup drive cost;
 *   failure returns false without another candidate probe or tree scan.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This one-candidate native observation coordinates no cross-request work;
 *   project selection owns visited/config reuse and consulted invalidation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isFile(location: string): boolean {
  try {
    return fs.statSync(location).isFile();
  } catch {
    return false;
  }
}
