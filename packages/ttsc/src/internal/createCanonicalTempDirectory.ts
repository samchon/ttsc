import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CanonicalTempDirectoryOperations } from "./CanonicalTempDirectoryOperations";

/**
 * Create a unique temporary directory under a frozen physical parent.
 *
 * The parent is resolved before creation so retargeting the caller's
 * TEMP/TMPDIR alias cannot redirect later writes or recursive cleanup. The
 * postflight accepts only a real directory that resolves to a direct child of
 * that same parent; a rejected child is deliberately left untouched because no
 * safe ownership identity was established.
 */
export function createCanonicalTempDirectory(
  prefix: string,
  parent: string = os.tmpdir(),
  operations: CanonicalTempDirectoryOperations = FILESYSTEM_OPERATIONS,
): string {
  if (prefix.length === 0 || path.basename(prefix) !== prefix) {
    throw new TypeError("ttsc: temporary directory prefix must be a basename");
  }
  const physicalParent = operations.realpath(path.resolve(parent));
  if (!operations.lstat(physicalParent).isDirectory()) {
    throw new Error(
      `ttsc: temporary directory parent is not a directory: ${physicalParent}`,
    );
  }
  const directory = operations.mkdtemp(path.join(physicalParent, prefix));
  if (!operations.lstat(directory).isDirectory()) {
    throw new Error(
      `ttsc: temporary directory postflight is not a directory: ${directory}`,
    );
  }
  const physicalDirectory = operations.realpath(directory);
  if (path.dirname(physicalDirectory) !== physicalParent) {
    throw new Error(
      `ttsc: temporary directory escaped its physical parent: ${physicalDirectory}`,
    );
  }
  return physicalDirectory;
}

const FILESYSTEM_OPERATIONS: CanonicalTempDirectoryOperations = {
  lstat: fs.lstatSync,
  mkdtemp: fs.mkdtempSync,
  realpath: fs.realpathSync.native,
};
