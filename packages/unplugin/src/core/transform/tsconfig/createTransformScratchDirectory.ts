import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pathIsWithin } from "../filesystem/pathIsWithin";

/** Create compiler scratch storage outside the project snapshot and watchers. */
export function createTransformScratchDirectory(
  projectRoot: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string {
  const root = path.resolve(projectRoot);
  const canonicalRoot = filesystem.realpath(root);
  const platformTemp =
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Temp")
      : "/tmp";
  const candidates = [
    os.tmpdir(),
    platformTemp,
    path.dirname(root),
    os.homedir(),
  ];
  const canonicalCandidates = new Set<string>();
  let failure: unknown;
  for (const candidate of new Set(candidates.map((dir) => path.resolve(dir)))) {
    if (pathIsWithin(candidate, root)) continue;
    let canonicalCandidate: string;
    try {
      canonicalCandidate = filesystem.realpath(candidate);
    } catch (error) {
      failure = error;
      continue;
    }
    if (
      pathIsWithin(canonicalCandidate, canonicalRoot) ||
      canonicalCandidates.has(canonicalCandidate)
    ) {
      continue;
    }
    canonicalCandidates.add(canonicalCandidate);
    let directory: string;
    try {
      directory = fs.mkdtempSync(
        path.join(canonicalCandidate, "ttsc-unplugin-"),
      );
    } catch (error) {
      failure = error;
      continue;
    }
    let canonicalDirectory: string;
    try {
      canonicalDirectory = filesystem.realpath(directory);
    } catch (error) {
      try {
        fs.rmdirSync(directory);
      } catch (cleanupError) {
        throw cleanupError;
      }
      failure = error;
      continue;
    }
    // Use the postflight canonical spelling from this point onward. Returning
    // the candidate-relative spelling would let another process retarget its
    // parent symlink/junction after validation, redirecting compiler writes or
    // the final recursive removal into the project.
    if (!pathIsWithin(canonicalDirectory, canonicalRoot)) {
      return canonicalDirectory;
    }
    // Refuse the result and synchronously remove only our empty random child
    // through the identity that the postflight check just classified.
    fs.rmdirSync(canonicalDirectory);
  }
  throw (
    failure ??
    new Error("ttsc: no temporary directory exists outside the project")
  );
}
