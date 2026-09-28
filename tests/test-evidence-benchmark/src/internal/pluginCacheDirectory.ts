import fs from "node:fs";
import path from "node:path";

import { suiteRoot } from "./suiteRoot";

/**
 * Pins the ttsc plugin build cache to the root selected before this suite's own
 * ttsx launch, so the nested benchmark CLI reuses the same typia binary.
 *
 * The default location is `<workspaceRoot>/node_modules/.cache/ttsc`, and every
 * workspace here is a fresh temporary tree with a fresh `node_modules` — so the
 * default makes every prepared workspace pay the cold Go link that statically
 * links this plugin into the lint binary, which ttsc itself warns "can take
 * several minutes on a cold Go cache". The package's start preloader sets one
 * absolute suite cache before ttsx builds the suite, and this helper passes the
 * same root to every workspace and the benchmark CLI. The first build pays once
 * and later launches reuse its content-addressed binary.
 *
 * The cache is keyed by content, so sharing it is not a stale-result risk:
 * editing a rule changes the key and the affected runs relink. The feature
 * suite in `tests/test-evidence` pins its own cache the same way.
 */
export const pluginCacheDirectory = (): string => {
  const location: string = path.resolve(
    suiteRoot,
    process.env.TTSC_CACHE_DIR ?? path.join(".cache", "ttsc"),
  );
  fs.mkdirSync(location, { recursive: true });
  return location;
};
