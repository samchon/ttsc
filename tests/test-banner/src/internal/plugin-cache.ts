/**
 * Shared, content-addressed plugin cache dir reused by feature tests that
 * exercise the `@ttsc/banner` source plugin but do not assert on the build
 * itself.
 *
 * `buildSourcePlugin` keys cached binaries by (plugin source, contributors,
 * overlays, go binary, ttsc/tsgo versions), so identical inputs resolve to the
 * same warm entry. Feature tests run sequentially (`DynamicExecutor.validate`
 * with the default `simultaneous: 1`), so pointing every plugin-using test that
 * does not observe build stderr at one cache root means only the first test for
 * a given plugin cold-builds; the rest hit warm. That cuts the per-test cold
 * `@ttsc/banner` builds (ten-plus seconds each) down to one.
 *
 * Tests whose purpose IS to observe a cold build, a warm cache hit, cache
 * pruning, invalidation, or a build failure keep their own isolated
 * `TestProject.tmpdir(...)` cache so a shared warm entry cannot mask the
 * behavior under test.
 *
 * Concurrent writers into one cache root stay safe: `publishBuiltBinary` copies
 * to a unique `.tmp` then atomically renames, tolerating EEXIST/EPERM/EACCES
 * when another builder wins.
 */
import { TestProject } from "@ttsc/testing";

export const SHARED_PLUGIN_CACHE_DIR = TestProject.tmpdir(
  "ttsc-shared-banner-cache-",
);
