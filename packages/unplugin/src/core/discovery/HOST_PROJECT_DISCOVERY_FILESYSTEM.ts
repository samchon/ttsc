import fs from "node:fs";

import type { TtscProjectDiscoveryFilesystem } from "./TtscProjectDiscoveryFilesystem";

/**
 * The host filesystem view nearest-project discovery uses when the caller
 * supplies none.
 *
 * Only `stat` is needed: discovery walks upward from a transformed file and
 * accepts the first `tsconfig.json` proven to be a regular file, following
 * links the way an ordinary config open does.
 */
export const HOST_PROJECT_DISCOVERY_FILESYSTEM: TtscProjectDiscoveryFilesystem =
  Object.freeze({
    stat: fs.statSync,
  });
