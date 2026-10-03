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
} from "../../../internal/ttsc/internal/compiler";

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
 * @evidence contracts/testing.md#behavioral-verification Prepares a real Go-source descriptor under context.env TTSC_CACHE_DIR=.cache/ttsc, requires count1 and a selected path below the plugin root, seeds the Go cache and checks exact removed roots and disappearance. A selected path/root existence does not independently certify executable bytes or a new build.
 * @evidence contracts/testing.md#independent-expectations The relative environment path resolves from the instance cwd; literal plugin/go-build child paths establish the expected cleanup roots independently of the returned list.
 * @evidence contracts/testing.md#distinguishing-cases This relative environment selection complements explicit cacheDir cleanup and two-instance environment isolation, checking both plugin and Go build roots.
 * @evidence contracts/testing.md#execution-ownership The named feature uses the shared API subclass over the checkout built lib/index.js and selected resolveTsgo binary. The explicit context env overrides its default shared-cache injection; this is not packed installation or pure path calculation.
 * @evidence contracts/e2e.md#necessary-boundary Actual descriptor/source-plugin preparation followed by native cache removal checks their shared context anchor. The observed count/path/root establish selection and deletion; they do not prove that this invocation rebuilt or loaded an executable. The authored Go-cache seed has no independent Go producer.
 * @evidence contracts/e2e.md#shared-execution One prepare resolves the selected plugin and one clean checks both roots. The explicit private cache intentionally preserves destructive ownership; prepare/build/cache-hit/Program populations require actual events rather than API-call or returned-path counts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The physical fresh project contains its own relative cache, and the synthetic Go-cache seed contrasts with actual plugin preparation. The compiler receives supplied env without ambient mutation, alongside inherited environment read by actual execution. Normal tracked fixture cleanup does not certify forced interruption or arbitrary descendant shutdown.
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
