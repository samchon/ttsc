import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pathIsWithin } from "../filesystem/pathIsWithin";

/**
 * Create compiler scratch storage outside the project snapshot and watchers.
 *
 * Candidate parents are checked lexically and physically before creation. The
 * created child's postflight physical address is checked again and returned,
 * so later compiler writes and disposal do not follow a retargeted parent link.
 * Failed candidates are skipped only after their owned empty child is removed.
 *
 * @evidence contracts/common.md#principled-implementation Preflight and postflight containment reject scratch directories inside the physical project; the returned physical child address preserves the checked removal and compiler-write target.
 * @evidence contracts/common.md#clear-and-simple-design One bounded candidate loop owns creation and immediate rejection cleanup, while the capturing generation owns the lifetime of an accepted directory.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed outside-project check never falls back to project scratch, and rejected child cleanup failures propagate instead of being hidden as another candidate miss.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain both identity checks, the returned physical spelling and the ownership condition on skipping a failed candidate; inline comments justify postflight removal.
 * @evidence contracts/portability.md#os-neutral-implementation Node os and path provide native temporary/home candidates and containment; physical checks use the injected view, while actual random-child creation and removal use native fs without shell commands or blanket case folding.
 * @evidence contracts/performance.md#efficient-algorithms A fixed candidate population is deduplicated before realpath and creation, with one successful random-child allocation; rejected candidates do not trigger a project-tree scan.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Scratch allocation is an ownership-bearing effect for one capture and must not be shared merely because two generations select the same candidate parent.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Rejected random empty children are removed synchronously and removal failure propagates; an accepted physical directory transfers to the generation owner for cleanup after compile/adoption lifetime ends.
 */
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
      // A child this call created and cannot remove is a leak, not a skipped
      // candidate, so its removal failure propagates.
      fs.rmdirSync(directory);
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
