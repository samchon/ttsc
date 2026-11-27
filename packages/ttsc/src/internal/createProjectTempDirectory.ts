import path from "node:path";

import { createCanonicalTempDirectory } from "./createCanonicalTempDirectory";
import { systemTempOutsideProject } from "./systemTempOutsideProject";

/**
 * Allocate below a system temp parent qualified against the operation's project
 * roots and the invoking process. An orphan source has no project root. In that
 * case the native selector still excludes marked project directories.
 *
 * A failed postflight can leave an allocation whose ownership was unproven.
 *
 * @evidence contracts/common.md#principled-implementation A project consumer supplies the project it actually read, including a custom config outside the process cwd. A projectless consumer relies on the selector's project markers.
 * @evidence contracts/common.md#clear-and-simple-design The system selector owns placement and the canonical creator owns allocation and postflight.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ambient temp must pass the same project-boundary check as each platform fallback.
 * @evidence contracts/common.md#meaningful-documentation Identifies the operation roots and allocation owner.
 * @evidence contracts/portability.md#os-neutral-implementation Delegates native containment, aliases and platform candidates to the system selector.
 * @evidence contracts/performance.md#efficient-algorithms Observes supplied roots and candidate ancestry without listing a directory. Only permission refusals advance to a second allocation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each allocation requires current observations and a unique destination.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The accepted physical directory transfers to the operation for cleanup. Failed postflight can retain an allocation, including when a permission refusal advances to another parent. This helper retains no native handles.
 */
export function createProjectTempDirectory(
  prefix: string,
  projectRoot?: string,
  additionalProjectRoots?: readonly string[],
): string {
  let refusal: unknown;
  const cwd = process.cwd();
  for (const { directory } of systemTempOutsideProject.candidates(
    projectRoot ?? path.parse(cwd).root,
    [
      ...(additionalProjectRoots ?? []),
      ...(projectRoot === undefined ? [] : [cwd]),
    ],
  )) {
    try {
      return createCanonicalTempDirectory(prefix, directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "EACCES" && code !== "EPERM" && code !== "EROFS")
        throw error;
      refusal ??= error;
    }
  }
  throw (
    refusal ??
    new Error(
      projectRoot === undefined
        ? "ttsc: no existing system temporary directory"
        : `ttsc: no existing system temporary directory outside ${projectRoot}`,
    )
  );
}
