import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";
import { isolatedCacheEnvironment } from "../../../internal/ttsc/internal/isolated-cache-environment";

/**
 * Verifies `ttsc clean` removes ttsc-owned Go cache but keeps user GOCACHE.
 *
 * `TTSC_GO_CACHE_DIR` is an explicit ttsc source-plugin cache location, while
 * `GOCACHE` belongs to the caller's broader Go toolchain. Clean should remove
 * the former together with ttsc's default cache roots and leave the latter
 * untouched.
 *
 * 1. Seed the default ttsc cache, a `TTSC_GO_CACHE_DIR`, and a user `GOCACHE`.
 * 2. Run `ttsc clean` with both Go cache environment variables set.
 * 3. Assert ttsc-owned caches are gone and `GOCACHE` still exists.
 *
 * @evidence contracts/testing.md#behavioral-verification A real clean command removes seeded plugin cache, default Go build cache and explicit TTSC_GO_CACHE_DIR while leaving a separately seeded user GOCACHE present, exposing overbroad cache reclamation.
 * @evidence contracts/testing.md#independent-expectations The ownership contract assigns ttsc roots to cleanup and caller GOCACHE to preservation. The test independently creates all four locations before execution and checks resulting existence, so these are behavioral deletion results rather than committed arrangement checks. It does not inspect preserved seed bytes.
 * @evidence contracts/testing.md#distinguishing-cases Default ttsc source/object caches and explicit ttsc Go cache are positive deletions, while distinct user Go cache is the negative control. All machine cache location variables are redirected below the fixture to isolate legacy cleanup.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_clean_removes_ttsc_go_cache_but_keeps_user_gocache in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by the unit-module executor.
 * @evidence contracts/e2e.md#necessary-boundary The real launcher resolves cache ownership from child environment and performs filesystem deletion. A unit cache-root table cannot prove the public clean command deletes exactly those consumer resources.
 * @evidence contracts/e2e.md#shared-execution One commonJsProject consumer, one built launcher and one set of seeded cache directories serve one clean invocation. There is no compiler or native contributor build; seeding distinguishes deletion and preservation within the same command.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique consumer paths isolate all four caches. An explicit pnpm workspace marker prevents an ancestor installation from owning the default cache. isolatedCacheEnvironment resets inherited cache overrides and places home/temp paths in the child fixture; this command then supplies its dedicated ttsc Go cache and protected user Go cache. The child exits synchronously and TestProject cleans roots at runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_clean_removes_ttsc_go_cache_but_keeps_user_gocache. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_clean_removes_ttsc_go_cache_but_keeps_user_gocache =
  (): void => {
    const root = commonJsProject(FixtureFiles.read("ttsc/ttsc_clean_removes_ttsc_go_cache_but_keeps_user_gocache/inputs-1"));
    const cacheRoot = path.join(root, "node_modules", ".cache", "ttsc");
    const pluginCache = path.join(cacheRoot, "plugins");
    const defaultGoBuildCache = path.join(cacheRoot, "go-build");
    const ttscGoCache = path.join(root, ".ttsc-go-build");
    const userGoCache = path.join(root, ".user-go-cache");
    for (const target of [
      path.join(pluginCache, "a"),
      defaultGoBuildCache,
      ttscGoCache,
      userGoCache,
    ]) {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "seed"), "cache\n", "utf8");
    }

    const result = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: {
        ...isolatedCacheEnvironment(root),
        GOCACHE: userGoCache,
        TTSC_GO_CACHE_DIR: ttscGoCache,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(pluginCache), false);
    assert.equal(fs.existsSync(defaultGoBuildCache), false);
    assert.equal(fs.existsSync(ttscGoCache), false);
    assert.equal(fs.existsSync(userGoCache), true);
  };
