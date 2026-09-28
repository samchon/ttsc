/**
 * Shared, content-addressed plugin cache dir reused by feature tests that
 * exercise source plugins but do not assert on the build itself.
 *
 * `buildSourcePlugin` keys cached binaries by (plugin source, contributors,
 * overlays, go binary, ttsc/tsgo versions), so identical inputs resolve to the
 * same warm entry. Feature tests run sequentially (`DynamicExecutor.validate`
 * with the default `simultaneous: 1`), so pointing every plugin-using test that
 * does not observe build stderr at one cache root means only the first test for
 * a given plugin cold-builds; the rest hit warm. That cuts roughly twenty cold
 * `@ttsc/lint` builds (ten-plus seconds each) down to one per distinct plugin.
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
import path from "node:path";

export const SHARED_PLUGIN_CACHE_DIR = TestProject.sharedPluginCache();

/**
 * The Go object cache of `SHARED_PLUGIN_CACHE_DIR`, for a test that observes a
 * cold plugin build in a cache of its own.
 *
 * A fresh plugin cache also starts a fresh Go object cache below it, which
 * compiles the whole linked host, typescript-go included, again. That build is
 * not what such a test observes: it asserts that the plugin binary is built,
 * and the binary is still built when the Go objects it links are warm. Every
 * one of those caches stayed on disk until the process exited, and the Windows
 * runner ran out of disk in the lane that holds them. `TTSC_GO_CACHE_DIR`
 * pointed here shares the objects, which Go keeps safe to share between
 * concurrent builds, while the plugin cache stays the test's own.
 */
export const SHARED_GO_BUILD_CACHE_DIR = path.join(
  SHARED_PLUGIN_CACHE_DIR,
  "go-build",
);
