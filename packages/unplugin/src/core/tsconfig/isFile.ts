import fs from "node:fs";

/**
 * Whether a path currently resolves to a regular file.
 *
 * Any failure to stat counts as "not a file", because `extends` resolution only
 * needs to know whether a candidate can be opened as a config.
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
 */
export function isFile(location: string): boolean {
  try {
    return fs.statSync(location).isFile();
  } catch {
    return false;
  }
}
