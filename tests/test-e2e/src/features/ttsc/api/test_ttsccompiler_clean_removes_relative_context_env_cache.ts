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
 * @evidence contracts/e2e.md#shared-execution One prepare and one clean retain selected-plugin/both-root checks. Consolidated execution borrows the explicit-cache owner's verified unchanged project and source descriptor/module instead of writing an identical second project. Its private namespace must be absent before the original relative-env preparation. Actual build/cache-hit/Program populations remain separate from call and returned-path counts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Standalone execution keeps its original physical fresh project. Borrowed execution requires the absent .cache namespace after prior explicit cleanup and uses the verified unchanged source inputs, preserving cold selected-cache contrast; the Go seed still contrasts synthetic removal with real plugin preparation. Supplied env does not mutate ambient state. Outer borrowed retention and normal standalone cleanup do not certify interruption or descendant shutdown.
 * @evidence contracts/e2e.md#preserved-coverage Prepared count/location, actual root existence, exact removed roots and both disappearance checks remain. The Go seed checks removal rather than a real Go object producer.
 */
export const test_ttsccompiler_clean_removes_relative_context_env_cache =
  (preparedRoot?: string) => {
    const root = TestProject.physicalPath(
      preparedRoot ?? createProject({
        plugins: [{ transform: "./plugin.cjs" }],
      }),
    );
    if (preparedRoot === undefined)
      writeSourcePlugin(root);
    else
      assert.equal(fs.existsSync(path.join(root, ".cache")), false, "relative cache profile requires a cold private namespace");
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      env: { TTSC_CACHE_DIR: ".cache/ttsc" },
    });
    const cacheRoot = path.join(root, ".cache", "ttsc", "plugins");
    const goBuildRoot = path.join(root, ".cache", "ttsc", "go-build");
    const inputBytes: [string, Buffer][] = [];
    if (preparedRoot !== undefined)
      for (const name of ["package.json", "tsconfig.json", "src/main.ts", "plugin.cjs", "plugin-go/go.mod", "plugin-go/main.go"])
        inputBytes.push([name, fs.readFileSync(path.join(root, name))]);

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
    if (preparedRoot !== undefined)
      for (const [name, bytes] of inputBytes)
        assert.deepEqual(fs.readFileSync(path.join(root, name)), bytes, `relative prepare/clean changed shared input ${name}`);
  };
