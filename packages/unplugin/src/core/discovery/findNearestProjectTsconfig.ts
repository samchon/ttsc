import { HOST_PROJECT_DISCOVERY_FILESYSTEM } from "./HOST_PROJECT_DISCOVERY_FILESYSTEM";
import type { TtscProjectDiscoveryFilesystem } from "./TtscProjectDiscoveryFilesystem";
import { findNearestProjectTsconfigImpl } from "./findNearestProjectTsconfigImpl";

/**
 * Find the nearest ancestor `tsconfig.json` that is proven to be a file.
 *
 * A directory, broken link, permission failure, or any other unprovable
 * candidate cannot terminate the walk. `stat` deliberately follows links, so a
 * link to a regular file retains its lexical config spelling.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The delegated walk chooses the first ancestor candidate whose stat proves
 *   a regular file; non-file candidates cannot become the implicit project.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This entry point exposes selection without observations while sharing the
 *   same implementation with the evidence-retaining discovery entry point.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared walk uses the observed platform's path API and link-following
 *   stat. This entry adds no host-OS case or separator inference.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   An injected filesystem is an explicit observation boundary; selection
 *   does not patch global stat or branch on fixture identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native documentation distinguishes file-kind proof, link following and
 *   lexical result spelling in separate purpose and boundary paragraphs.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function findNearestProjectTsconfig(
  startDirectory: string,
  filesystem: TtscProjectDiscoveryFilesystem = HOST_PROJECT_DISCOVERY_FILESYSTEM,
): string | undefined {
  return findNearestProjectTsconfigImpl(startDirectory, filesystem);
}
