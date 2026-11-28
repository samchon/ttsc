import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { systemTempOutsideProject } from "../../../internal/systemTempOutsideProject";
import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * Locate the existing or prospective ttsx cache within verified system temp.
 * The caller supplies a physical temporary directory outside the project. Each
 * existing child must be an ordinary directory before the caller may create the
 * runtime root. The run index, sibling lock and retirement directory also
 * require ordinary directory entries. These observations require stable names.
 *
 * @evidence contracts/common.md#principled-implementation The predictable runtime and lock coordinates are checked without following links before use, so a safe system parent does not authorize redirected cache writes.
 * @evidence contracts/common.md#clear-and-simple-design The helper computes and validates the fallback path. Runtime creation and lock admission remain with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native metadata distinguishes absent names, links and ordinary directories. No attempted write supplies the validation result.
 * @evidence contracts/common.md#meaningful-documentation The prose states the verified parent premise, the checked children, and the path stability limit.
 * @evidence contracts/portability.md#os-neutral-implementation Native path construction and lstat observe POSIX links and Windows junctions without an assumed separator or case policy.
 * @evidence contracts/performance.md#efficient-algorithms Hashing consumes the project path bytes and five metadata observations validate the candidate without enumerating its contents.
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
  for (const candidate of [
    parent,
    fallback,
    path.join(fallback, SourceBuildCacheLayout.RUNTIME_PROJECT_DIRNAME),
    lock,
    retired,
  ]) {
    const entry = fs.lstatSync(candidate, { throwIfNoEntry: false });
    if (entry !== undefined && !entry.isDirectory())
      throw new UnsafeSystemRuntimeCacheDirectory(candidate);
  }
  return fallback;
}

/**
 * Create each missing child under its observed physical parent. A cache or lock
 * that overlaps a known project leaves this temp candidate ineligible. An
 * existing alias also excludes the candidate before creation starts. Revalidate
 * native identities before creation and again before returning. These checks do
 * not hold a directory handle across a namespace change.
 *
 * @evidence contracts/common.md#principled-implementation The qualified temp parent and deterministic children keep their exact physical spellings. Known project roots exclude storage and its sibling lock before creation.
 * @evidence contracts/common.md#clear-and-simple-design The existing layout check owns ordinary-directory admission, and this operation owns nonrecursive creation and postflight.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing entries alone may be created. An existing alias or a failed recheck cannot authorize a run claim.
 * @evidence contracts/common.md#meaningful-documentation Describes candidate ineligibility, checked placement and the native namespace premise.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath qualifies physical names. POSIX byte witnesses retain project ancestry that cannot round-trip through a string.
 * @evidence contracts/performance.md#efficient-algorithms Each nominated root and cache component needs a bounded number of native observations without directory enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current filesystem observations qualify every acquisition.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The cache persists for later runs. A failed acquisition can leave an ordinary cache parent created earlier. This function acquires no open descriptor or run lease.
 */
export function pinSystemRuntimeCachePath(
  root: string,
  temporary: string,
  projectRoots: readonly string[],
): string | undefined {
  let fallback: string;
  try {
    requirePhysical(temporary);
    fallback = systemRuntimeCachePath(root, temporary);
  } catch (error) {
    if (error instanceof UnsafeSystemRuntimeCacheDirectory) return undefined;
    throw error;
  }
  const parent = path.dirname(fallback);
  const lock = `${fallback}.lock`;
  const index = path.join(
    fallback,
    SourceBuildCacheLayout.RUNTIME_PROJECT_DIRNAME,
  );
  const retired = path.join(
    lock,
    DependencyBuildLockProtocol.DEP_BUILD_LOCK_RETIRED_DIR,
  );
  const roots = [root, ...projectRoots];
  const eligible = () =>
    [fallback, index, lock, retired].every((directory) =>
      systemTempOutsideProject.allowsChild(directory, roots),
    );
  if (!eligible()) return undefined;
  for (const [current, next] of [
    [temporary, parent],
    [parent, fallback],
  ] as const) {
    systemRuntimeCachePath(root, temporary);
    requirePhysical(current);
    try {
      fs.mkdirSync(next);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    requirePhysical(next);
  }
  systemRuntimeCachePath(root, temporary);
  requirePhysical(fallback);
  if (!eligible()) return undefined;
  requireWritableParent(index);
  requireWritableParent(lock);
  requireWritableParent(retired);
  return fallback;
}

/** Check the first existing directory that would receive a claim write. */
function requireWritableParent(directory: string): void {
  let parent = directory;
  while (fs.lstatSync(parent, { throwIfNoEntry: false }) === undefined)
    parent = path.dirname(parent);
  fs.accessSync(parent, fs.constants.W_OK | fs.constants.X_OK);
}

/** Refuse link-following as proof of the selected physical directory. */
function requirePhysical(directory: string): void {
  if (
    !fs.lstatSync(directory).isDirectory() ||
    RuntimeFilesystem.realpathWitness(directory) !== directory
  )
    throw new UnsafeSystemRuntimeCacheDirectory(directory);
}

class UnsafeSystemRuntimeCacheDirectory extends Error {
  public constructor(directory: string) {
    super(`ttsx: unsafe system runtime cache directory: ${directory}`);
  }
}
