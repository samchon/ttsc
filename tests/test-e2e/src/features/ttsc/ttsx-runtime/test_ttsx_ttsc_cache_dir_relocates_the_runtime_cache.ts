import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
  ttsxBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies ttsx TTSC_CACHE_DIR: relocates the runtime cache.
 *
 * `TTSC_CACHE_DIR` already owns source-plugin placement. Leaving transient
 * runtime output under the project gives one invocation two cache roots and can
 * create a false nested-project boundary even though plugins are shared.
 *
 * 1. Create a project and an external caller-owned cache root.
 * 2. Run ttsx with `TTSC_CACHE_DIR` and assert the program succeeds.
 * 3. Assert runtime and cache-path state use that root and touch no local cache.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx uses TTSC_CACHE_DIR, succeeds, leaves no local node_modules and no completed project run, then public cache paths reports the exact external root.
 * @evidence contracts/testing.md#independent-expectations The authored log, caller-selected cache path and empty completed-run directory determine expectations independently of path computation.
 * @evidence contracts/testing.md#distinguishing-cases External placement contrasts with absence of local cache; public inspection follows completed execution. Relative/local-boundary paths have other owners.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns one runtime host and one public cache inspection command.
 * @evidence contracts/e2e.md#necessary-boundary Runtime placement, process cleanup and public inspection must agree on the override; direct path units cannot certify actual output lifetime.
 * @evidence contracts/e2e.md#shared-execution One root/external cache serves runtime and inspection. Inspection consumes completed state rather than repeating a build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Runtime finishes before inspection; both receive identical override input and tracked fixtures are retained until cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original success/log, no local node_modules, empty external project directory and exact public root remain.
 */
export function test_ttsx_ttsc_cache_dir_relocates_the_runtime_cache() {
  const root = createProject(
    FixtureFiles.read(
      "ttsc/ttsx_ttsc_cache_dir_relocates_the_runtime_cache/inputs-1",
    ),
  );
  const cache = createProject({});
  const env = { TTSC_CACHE_DIR: cache };

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
    cwd: root,
    env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "relocated-runtime-cache");
  assert.equal(fs.existsSync(path.join(root, "node_modules")), false);
  assert.deepEqual(fs.readdirSync(path.join(cache, "ttsx", "project")), []);

  const paths = spawn(ttscBin, ["cache", "paths", "--json", "--cwd", root], {
    cwd: root,
    env,
  });
  assert.equal(paths.status, 0, paths.stderr);
  assert.equal(
    (JSON.parse(paths.stdout) as { cacheRoot: string }).cacheRoot,
    cache,
  );
}
