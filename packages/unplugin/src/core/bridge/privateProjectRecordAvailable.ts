import fs from "node:fs";
import path from "node:path";

import { fallbackRecordStorage } from "./fallbackRecordStorage";

/**
 * Check whether a record is a regular file in qualified managed storage.
 *
 * @evidence contracts/common.md#principled-implementation Directory qualification precedes the record file kind check.
 * @evidence contracts/common.md#clear-and-simple-design Readers share the same managed record eligibility check.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A linked record does not qualify even when its target is a regular file.
 * @evidence contracts/common.md#meaningful-documentation The comment names both requirements for eligibility.
 * @evidence contracts/portability.md#os-neutral-implementation Native lstat rejects linked files and delegates available ownership checks to the directory validator.
 * @evidence contracts/performance.md#efficient-algorithms A bounded directory traversal precedes one native file-kind lookup.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every call observes current storage topology.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No file handle or verdict is retained.
 */
export function privateProjectRecordAvailable(file: string): boolean {
  if (fallbackRecordStorage(path.dirname(file), false) !== true) return false;
  try {
    return fs.lstatSync(file, { throwIfNoEntry: false })?.isFile() === true;
  } catch {
    return false;
  }
}
