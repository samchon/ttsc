import { TestProject } from "@ttsc/testing";

import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  fs,
  path,
  tsgo,
  writeSourcePlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.clean removes relative context env cache.
 *
 * `TtscCompiler.prepare()` resolves `env.TTSC_CACHE_DIR` through the project
 * root because it flows into the source-plugin builder as an explicit cache
 * root. `clean()` must use the same anchor or embedded hosts leave the cache
 * behind when their process cwd differs from the project cwd.
 *
 * 1. Create a project with a source plugin and relative `env.TTSC_CACHE_DIR`.
 * 2. Prepare the plugin cache through the programmatic API.
 * 3. Assert `clean()` removes the same project-root cache directories.
 *
 * @evidence contracts/testing.md#behavioral-verification Prepares a real Go plugin under context.env TTSC_CACHE_DIR=.cache/ttsc, seeds its Go build cache and checks clean returns and removes exactly both derived roots.
 * @evidence contracts/testing.md#independent-expectations The relative environment path resolves from the instance cwd; literal plugin/go-build child paths establish the expected cleanup roots independently of the returned list.
 * @evidence contracts/testing.md#distinguishing-cases This relative environment selection complements explicit cacheDir cleanup and two-instance environment isolation, checking both plugin and Go build roots.
 * @evidence contracts/testing.md#execution-ownership The exported feature executes real prepare and filesystem clean through the API under TestExecutor.
 * @evidence contracts/e2e.md#necessary-boundary A successfully built plugin must land in the instance-selected cache and clean must remove that actual artifact plus the configured Go cache; path computation alone cannot prove deletion.
 * @evidence contracts/e2e.md#shared-execution One prepare produces the plugin and one clean checks both roots; the custom cache is deliberately not shared because deletion and environment-path ownership are the behavior.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The physical fresh project contains its own relative cache, and the synthetic Go-cache seed contrasts with actual plugin preparation. The compiler receives instance env without ambient mutation; fixture cleanup belongs to TestProject.
 * @evidence contracts/e2e.md#preserved-coverage Prepared count/location, actual root existence, exact removed roots and both disappearance checks remain. The Go seed checks removal rather than a real Go object producer.
 */
export const test_ttsccompiler_clean_removes_relative_context_env_cache =
  () => {
    const root = TestProject.physicalPath(
      createProject({
        plugins: [{ transform: "./plugin.cjs" }],
      }),
    );
    writeSourcePlugin(root);
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      env: { TTSC_CACHE_DIR: ".cache/ttsc" },
    });
    const cacheRoot = path.join(root, ".cache", "ttsc", "plugins");
    const goBuildRoot = path.join(root, ".cache", "ttsc", "go-build");

    const prepared = compiler.prepare();

    assert.equal(prepared.length, 1);
    assert.equal(
      expectArrayValue(prepared, 0).startsWith(cacheRoot + path.sep),
      true,
    );
    assert.equal(fs.existsSync(cacheRoot), true);
    fs.mkdirSync(goBuildRoot, { recursive: true });
    fs.writeFileSync(path.join(goBuildRoot, "seed"), "go object\n", "utf8");

    const removed = compiler.clean();

    assert.deepEqual(removed, [cacheRoot, goBuildRoot]);
    assert.equal(fs.existsSync(cacheRoot), false);
    assert.equal(fs.existsSync(goBuildRoot), false);
  };
