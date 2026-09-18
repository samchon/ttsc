import { HOST_PROJECT_DISCOVERY_FILESYSTEM } from "./HOST_PROJECT_DISCOVERY_FILESYSTEM";
import type { TtscProjectDiscoveryFilesystem } from "./TtscProjectDiscoveryFilesystem";
import type { TtscProjectTsconfigCandidate } from "./TtscProjectTsconfigCandidate";
import type { TtscProjectTsconfigDiscovery } from "./TtscProjectTsconfigDiscovery";
import { findNearestProjectTsconfigImpl } from "./findNearestProjectTsconfigImpl";

/**
 * Find the nearest config and retain the exact predicate observations used to
 * select it. A cache host must not rediscover these candidates later: a file
 * can disappear only for selection and return before that second observation.
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
