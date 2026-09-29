import fs from "node:fs";
import path from "node:path";

import { suiteRoot } from "./suiteRoot";

/**
 * Pins the ttsc plugin build cache to one suite-owned directory.
 *
 * The default location is `<workspaceRoot>/node_modules/.cache/ttsc`, and every
 * fixture here is a fresh temp directory with a fresh node_modules — so the
 * default makes every single case pay the ~9-minute cold Go link, and the suite
 * grows by nine minutes per test. Pointing every fixture at one stable cache
 * means the first case pays once and the rest are seconds.
 *
 * The cache is keyed by content (plugin source plus toolchain versions), so a
 * shared cache is not a stale-result risk: editing a rule changes the key and
 * the affected cases relink.
 *
 * Every fixture must agree on that location, which is why the path is derived
 * here rather than written out at each caller.
 */
export const pluginCacheDirectory = (): string => {
  const location: string =
    process.env.TTSC_TEST_CACHE_DIR || path.join(suiteRoot, ".cache", "ttsc");
  fs.mkdirSync(location, { recursive: true });
  return location;
};
