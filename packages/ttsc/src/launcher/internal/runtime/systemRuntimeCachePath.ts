import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";

/**
 * Locate the existing or prospective ttsx cache within verified system temp.
 * The caller supplies a physical temporary directory outside the project. Each
 * existing child must be an ordinary directory before the caller may create the
 * runtime root. The sibling lock and its retirement directory are checked here
 * and again at acquisition. These observations require stable names.
 *
 * @evidence contracts/common.md#principled-implementation The predictable runtime and lock coordinates are checked without following links before use, so a safe system parent does not authorize redirected cache writes.
 * @evidence contracts/common.md#clear-and-simple-design The helper computes and validates the fallback path. Runtime creation and lock admission remain with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native metadata distinguishes absent names, links and ordinary directories. No attempted write supplies the validation result.
 * @evidence contracts/common.md#meaningful-documentation The prose states the verified parent premise, the checked children, and the path stability limit.
 * @evidence contracts/portability.md#os-neutral-implementation Native path construction and lstat observe POSIX links and Windows junctions without an assumed separator or case policy.
 * @evidence contracts/performance.md#efficient-algorithms Hashing consumes the project path bytes and up to four metadata observations validate the candidate without enumerating its contents.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A new call needs current directory information.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function acquires no handles and writes nothing.
 */
export function systemRuntimeCachePath(
  root: string,
  temporary: string,
): string {
  const parent = path.join(temporary, "ttsc-ttsx");
  const key = crypto
    .createHash("sha256")
    .update(root)
    .digest("hex")
    .slice(0, 16);
  const fallback = path.join(parent, key);
  const lock = `${fallback}.lock`;
  const retired = path.join(
    lock,
    DependencyBuildLockProtocol.DEP_BUILD_LOCK_RETIRED_DIR,
  );
  for (const candidate of [parent, fallback, lock, retired]) {
    const entry = fs.lstatSync(candidate, { throwIfNoEntry: false });
    if (entry !== undefined && !entry.isDirectory())
      throw new Error(
        `ttsx: unsafe system runtime cache directory: ${candidate}`,
      );
  }
  return fallback;
}
