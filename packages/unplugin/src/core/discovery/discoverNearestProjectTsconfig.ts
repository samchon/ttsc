import { HOST_PROJECT_DISCOVERY_FILESYSTEM } from "./HOST_PROJECT_DISCOVERY_FILESYSTEM";
import type { TtscProjectDiscoveryFilesystem } from "./TtscProjectDiscoveryFilesystem";
import type { TtscProjectTsconfigCandidate } from "./TtscProjectTsconfigCandidate";
import type { TtscProjectTsconfigDiscovery } from "./TtscProjectTsconfigDiscovery";
import { findNearestProjectTsconfigImpl } from "./findNearestProjectTsconfigImpl";

/**
 * Find the nearest config and retain the exact predicate observations used to
 * select it. False means not proven a regular file, including failed stat;
 * it is not an independent absence fact. A cache host must not rediscover
 * these candidates later as a replacement for the selection observation: a file
 * can disappear only for selection and return before that second observation.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared ancestor walk returns its selected file and the exact positive
 *   and negative predicates it used, keeping selection evidence contemporaneous.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This wrapper owns observation retention; selection policy remains in
 *   findNearestProjectTsconfigImpl rather than a second walk.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The supplied filesystem controls platform syntax and stat predicates;
 *   retained candidate spellings are native filenames, not URL or shell text.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   It records actual predicates rather than rediscovering a convenient
 *   explanation after selection or substituting consumer-specific configs.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the transient disappearance hazard that makes retained
 *   observations necessary, with prose separated from tags.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Delegated ancestor traversal resolves/joins/parent-scans each reached path
 *   and performs one stat per D levels. This result additionally retains D
 *   ordered candidate objects/path strings; no tree listing or byte read occurs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Synchronous stat handles belong to the supplied implementation; the ordered
 *   candidate array and selected spelling transfer to the result's caller.
 */
export function discoverNearestProjectTsconfig(
  startDirectory: string,
  filesystem: TtscProjectDiscoveryFilesystem = HOST_PROJECT_DISCOVERY_FILESYSTEM,
): TtscProjectTsconfigDiscovery {
  const candidates: TtscProjectTsconfigCandidate[] = [];
  return {
    candidates,
    file: findNearestProjectTsconfigImpl(
      startDirectory,
      filesystem,
      candidates,
    ),
  };
}
