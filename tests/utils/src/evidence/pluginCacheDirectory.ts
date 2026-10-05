import fs from "node:fs";
import path from "node:path";

import { EvidenceProcessOwnership } from "./EvidenceProcessOwnership";
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
 * Every fixture must agree on that location. Absolute resolution before mkdir
 * also prevents an environment-relative spelling being interpreted differently
 * by a child whose cwd is the fixture. Registered readers tie this real cache
 * to their fixture; an unresolved reader blocks aliases and later consumers.
 * Environment paths acquire no deletion or allocation-retention authority here.
 * The default uses the process's shared ownership registry. An explicit owner
 * serves separately owned inputs; it cannot reset the shared owner's state.
 *
 * @evidence contracts/common.md#principled-implementation Resolves one actual cache input before mkdir and process launch, checks unknown-reader admission and registers its native identity for the calling fixture.
 * @evidence contracts/common.md#clear-and-simple-design One helper selects environment or suite cache spelling, ensures the directory and connects it to the process-input owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cache admission does not certify a reusable compiler result or claim deletion authority over a foreign path; unknown readers refuse later cache use rather than allocate a substitute.
 * @evidence contracts/common.md#meaningful-documentation Explains relative environment resolution, shared content-key validity and the distinction between admission and filesystem cleanup authority.
 * @evidence contracts/portability.md#os-neutral-implementation Native absolute paths and registry realpath/stat identity keep parent and child cwd semantics equal without assuming case policy or inferring closure from a signal.
 * @evidence contracts/performance.md#reuse-equivalent-work Actual consumers share the selected cache under product content-key validation; registered unresolved readers block every later use of that physical cache, including a different fixture or path alias.
 */
export const pluginCacheDirectory = (
  directory?: string,
  ownership: Pick<
    ReturnType<typeof EvidenceProcessOwnership.create>,
    "assertAvailable" | "assertCacheAvailable" | "registerCache"
  > = EvidenceProcessOwnership,
): string => {
  const location: string = path.resolve(
    process.env.TTSC_TEST_CACHE_DIR || path.join(suiteRoot, ".cache", "ttsc"),
  );
  if (directory !== undefined) ownership.assertAvailable(directory);
  ownership.assertCacheAvailable(location);
  fs.mkdirSync(location, { recursive: true });
  if (directory !== undefined) ownership.registerCache(directory, location);
  return location;
};
