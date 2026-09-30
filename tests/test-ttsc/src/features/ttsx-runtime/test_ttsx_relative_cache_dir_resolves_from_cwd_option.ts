import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx relative cache dir resolves from cwd option.
 *
 * When `--cache-dir` is a relative path, it must be resolved against `--cwd`
 * (the project directory), not against the shell's working directory. A user
 * might invoke ttsx from a different directory while pointing at a project
 * elsewhere; the cache must land inside that project.
 *
 * 1. Create a project under one temp directory and a separate driver cwd.
 * 2. Run ttsx with `--cwd <project>` and `--cache-dir .ttsx-cache` from the driver
 *    cwd.
 * 3. Assert the cache directory was created inside the project, the per-run
 *    project output was cleaned, and no cache landed under the driver cwd.
 * @evidence contracts/testing.md#behavioral-verification Runs from a driver directory with --cwd project and relative --cache-dir .ttsx-cache, requiring the project-local cache and no driver-local project cache.
 * @evidence contracts/testing.md#independent-expectations The authored distinct driver/project paths and literal relative-runner-cache establish the location and execution oracle.
 * @evidence contracts/testing.md#distinguishing-cases The selected project cache exists and is empty after execution; the similarly named driver cache must be absent.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_relative_cache_dir_resolves_from_cwd_option at this path, selected by tests/e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual CLI cwd resolution, cache construction and Node execution distinguish resolving the relative cache against the wrong working directory.
 * @evidence contracts/e2e.md#shared-execution One host exercises both location alternatives using one source project and a separate driver directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The two tracked temporary roots are distinct; the child completes before cache inspection and both roots remain harness-owned until process exit.
 * @evidence contracts/e2e.md#preserved-coverage Exact stdout, selected cache existence/emptiness and wrong-root absence remain here; the explicit cache layout is not conflated with default placement.
 */
export function test_ttsx_relative_cache_dir_resolves_from_cwd_option() {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `const message: string = "relative-runner-cache";\nconsole.log(message);\n`,
  });
  const driverCwd = TestProject.tmpdir("ttsx-driver-");
  const cacheDir = ".ttsx-cache";

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
    { cwd: driverCwd },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "relative-runner-cache");
  const projectCache = path.join(root, cacheDir, "project");
  assert.equal(fs.existsSync(projectCache), true);
  assert.deepEqual(fs.readdirSync(projectCache), []);
  assert.equal(fs.existsSync(path.join(driverCwd, cacheDir, "project")), false);
}
