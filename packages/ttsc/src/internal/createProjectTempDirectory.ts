import { createCanonicalTempDirectory } from "./createCanonicalTempDirectory";
import { systemTempOutsideProject } from "./systemTempOutsideProject";

/**
 * Allocate below a system temp parent qualified against the operation's project
 * roots and the invoking process.
 *
 * @evidence contracts/common.md#principled-implementation The caller supplies the project it actually read, including a custom config or source outside the process cwd.
 * @evidence contracts/common.md#clear-and-simple-design The system selector owns placement and the canonical creator owns allocation and postflight.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ambient temp must pass the same project-boundary check as each platform fallback.
 * @evidence contracts/common.md#meaningful-documentation Identifies the operation roots and allocation owner.
 * @evidence contracts/portability.md#os-neutral-implementation Delegates native containment, aliases and platform candidates to the system selector.
 * @evidence contracts/performance.md#efficient-algorithms Observes only supplied roots, candidate ancestry and one allocation; it lists no directory.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each allocation requires current observations and a unique destination.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The accepted physical directory transfers to the operation for cleanup.
 */
export function createProjectTempDirectory(
  prefix: string,
  projectRoot: string,
  additionalProjectRoots?: readonly string[],
): string {
  return createCanonicalTempDirectory(
    prefix,
    systemTempOutsideProject(projectRoot, additionalProjectRoots),
  );
}
