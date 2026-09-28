import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a run reached through a linked index can claim and clean its output.
 *
 * Pinning `project` to its physical target changes the generation path's
 * parent. The child preload must still use the launcher's runtime lock rather
 * than deriving that lock from a parent directory named `project`.
 *
 * 1. Point an explicit cache's run index at another directory through a link.
 * 2. Run a TypeScript entry and require its checked JavaScript to execute.
 * 3. Assert normal cleanup removes the physical generation.
 */
export const test_ttsx_runs_through_a_linked_run_index = (): void => {
  const root = TestProject.tmpdir("ttsx-linked-run-index-");
  const project = path.join(root, "project");
  const cache = path.join(root, "cache");
  const physicalRuns = path.join(root, "physical-runs");
  TestProject.writeFiles(project, {
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "commonjs",
        outDir: "lib",
        strict: true,
        target: "ES2022",
        types: [],
      },
      include: ["src"],
    }),
    "src/main.ts": 'console.log("linked-run");\nexport {};\n',
  });
  fs.mkdirSync(cache);
  fs.mkdirSync(physicalRuns);
  fs.symlinkSync(
    physicalRuns,
    path.join(cache, "project"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", project, "--cache-dir", cache, "src/main.ts"],
    { cwd: project },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "linked-run");
  assert.deepEqual(fs.readdirSync(physicalRuns), []);
};
