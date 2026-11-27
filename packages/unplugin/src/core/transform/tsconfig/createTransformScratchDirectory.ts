import fs from "node:fs";
import path from "node:path";
import { systemTempOutsideProject } from "ttsc/internal/system-temp";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pathIsWithin } from "../filesystem/pathIsWithin";

/**
 * Create compiler scratch storage outside the project snapshot and watchers.
 *
 * The SDK qualifies system temporary parents against project ancestry. The
 * adapter also checks the current project's lexical worktree. The created
 * child's postflight physical address is checked again and returned, avoiding
 * reuse of the candidate's known lexical parent alias. These path observations
 * do not pin directory handles or rule out later native replacement. Failed
 * candidates are skipped only after their owned empty child is removed.
 *
 * @evidence contracts/common.md#principled-implementation Preflight and postflight containment reject observed scratch addresses inside the project; returning the checked child spelling avoids knowingly reusing an unresolved parent alias, without certifying later topology cannot change.
 * @evidence contracts/common.md#clear-and-simple-design One bounded candidate loop owns creation and immediate rejection cleanup, while the capturing generation owns the lifetime of an accepted directory.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed outside-project check never falls back to project scratch, and rejected child cleanup failures propagate instead of being hidden as another candidate miss.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain both identity checks, the returned physical spelling and the ownership condition on skipping a failed candidate; inline comments justify postflight removal.
 * @evidence contracts/portability.md#os-neutral-implementation The shared SDK selector qualifies native system temporary parents. Adapter containment checks retain their injected project view, and the native filesystem creates and removes the random child.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Rejected random empty children receive synchronous removal attempts; failure propagates and can leave an artifact rather than silently skipping it. Accepted directory ownership transfers to capture's finally cleanup or its separately retained clock owner. No native directory handle pins these path identities against later replacement.
 * @evidence contracts/performance.md#efficient-algorithms Two adapter ancestor walks and a bounded SDK candidate scan observe workspace markers without enumerating directory contents. Allocation tries each accepted physical parent at most once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Scratch allocation is an ownership-bearing effect for one capture and must not be shared merely because two generations select the same candidate parent.
 */
export function createTransformScratchDirectory(
  projectRoot: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string {
  const root = path.resolve(projectRoot);
  const canonicalRoot = filesystem.realpath(root);
  const protectedRoots = new Set([root, canonicalRoot]);
  for (const start of [root, canonicalRoot]) {
    for (let directory = start; ; directory = path.dirname(directory)) {
      if (
        fs.existsSync(path.join(directory, ".git")) ||
        fs.existsSync(path.join(directory, "pnpm-workspace.yaml"))
      )
        protectedRoots.add(directory);
      if (path.dirname(directory) === directory) break;
    }
  }
  const isProtected = (candidate: string): boolean =>
    [...protectedRoots].some((directory) => pathIsWithin(candidate, directory));
  const canonicalCandidates = new Set<string>();
  let failure: unknown;
  for (const {
    spelling,
    directory: canonicalCandidate,
  } of systemTempOutsideProject.candidates(root)) {
    if (
      isProtected(spelling) ||
      isProtected(canonicalCandidate) ||
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
    // the final recursive removal into the project through that known alias.
    // The returned path still is not an atomic handle against later replacement.
    if (!isProtected(canonicalDirectory)) {
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
