import fs from "node:fs";
import path from "node:path";

import { TTSC_TRANSFORM_SESSION_ENV } from "./TTSC_TRANSFORM_SESSION_ENV";

/**
 * The shared compile store of the pooled host session this process belongs to,
 * or `undefined` when there is none (samchon/ttsc#1390).
 *
 * A worker reads {@link TTSC_TRANSFORM_SESSION_ENV}, inherited from the process
 * that configured the pool. The value counts only as an absolute path to an
 * stat-classified directory. Missing or failed metadata leaves the worker
 * compiling for itself; acceptance here proves neither write permissions nor
 * continued existence, capacity or valid publication contents.
 *
 * @evidence contracts/common.md#principled-implementation The reader accepts only an absolute address whose current native stat reports a directory. Absent/failed metadata withdraws optional sharing; store claiming separately handles publication access, and this observation does not certify future availability or writability.
 * @evidence contracts/common.md#clear-and-simple-design The reader validates one environment value without opening stores, creating directories, or changing the caller's environment.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure withdraws only optional sharing and never fabricates a publication or compiler success.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies the inherited capability and precise absence behavior, including the reason failure is nonfatal.
 * @evidence contracts/portability.md#os-neutral-implementation Node native isAbsolute and stat interpret the inherited store address, preserving drive and root forms; an unavailable directory withdraws optional sharing rather than assuming a fixed OS storage layout.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources statSync returns before the function does; no handle is retained.
 * @evidence contracts/performance.md#efficient-algorithms One environment value is checked with native absolute-path grammar before at most one following stat. Native pathname resolution and filesystem access are part of that cost; syscall count does not bound their duration. No directory listing, record parse or output population is constructed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Re-read per call because the environment can change; the shared store itself is the reuse.
 */
export function readTtscTransformSession(): string | undefined {
  const directory = process.env[TTSC_TRANSFORM_SESSION_ENV];
  if (directory === undefined || !path.isAbsolute(directory)) {
    return undefined;
  }
  try {
    return fs.statSync(directory).isDirectory() ? directory : undefined;
  } catch {
    return undefined;
  }
}
