import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a linked run index cannot redirect failure cleanup to another run.
 *
 * The runtime cache root was pinned physically, but its `project` child could
 * itself be a junction. A descriptor runs after the generation is prepared and
 * can retarget that child before a later preparation error; cleanup through the
 * link would remove another directory with the same generation name.
 *
 * 1. Prepare through a linked `project` directory into an original run index.
 * 2. Retarget the link from a descriptor, seed a same-named victim, and fail.
 * 3. Assert only the original generation is cleaned and the victim survives.
 */
export const test_ttsx_failure_cleanup_pins_a_linked_run_index = (): void => {
  const root = TestProject.tmpdir("ttsx-run-index-alias-");
  const project = path.join(root, "project");
  const cache = path.join(root, "cache");
  const originalRuns = path.join(root, "original-runs");
  const victimRuns = path.join(root, "victim-runs");
  const alias = path.join(cache, "project");
  for (const directory of [cache, originalRuns, victimRuns]) {
    fs.mkdirSync(directory);
  }
  fs.symlinkSync(
    originalRuns,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  TestProject.writeFiles(project, {
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": TestProject.tsconfig({
      module: "commonjs",
      outDir: "dist",
      plugins: [{ transform: "./plugin.cjs" }],
      rootDir: "src",
      strict: true,
      target: "ES2022",
    }),
    "src/main.ts": 'console.log("unreached");\n',
    "plugin.cjs": [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      "const generations = fs.readdirSync(process.env.TTSC_TEST_ORIGINAL_RUNS);",
      'if (generations.length !== 1) throw new Error("expected one runtime generation");',
      "fs.rmSync(process.env.TTSC_TEST_RUN_INDEX_ALIAS, { force: true, recursive: true });",
      'fs.symlinkSync(process.env.TTSC_TEST_VICTIM_RUNS, process.env.TTSC_TEST_RUN_INDEX_ALIAS, process.platform === "win32" ? "junction" : "dir");',
      "const victim = path.join(process.env.TTSC_TEST_VICTIM_RUNS, generations[0]);",
      "fs.mkdirSync(victim, { recursive: true });",
      'fs.writeFileSync(path.join(victim, "keep.txt"), "victim", "utf8");',
      'module.exports = { name: "retarget", source: path.join(process.env.TTSC_TEST_PROJECT, "missing-plugin") };',
      "",
    ].join("\n"),
  });
  try {
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", project, "--cache-dir", cache, "src/main.ts"],
      {
        cwd: project,
        env: {
          TTSC_TEST_ORIGINAL_RUNS: originalRuns,
          TTSC_TEST_PROJECT: project,
          TTSC_TEST_RUN_INDEX_ALIAS: alias,
          TTSC_TEST_VICTIM_RUNS: victimRuns,
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /plugin "retarget" source does not exist/);
    const [generation, ...extra] = fs.readdirSync(victimRuns);
    assert.ok(generation);
    assert.deepEqual(extra, []);
    assert.equal(
      fs.readFileSync(path.join(victimRuns, generation, "keep.txt"), "utf8"),
      "victim",
    );
    assert.deepEqual(fs.readdirSync(originalRuns), []);
  } finally {
    fs.rmSync(alias, { force: true, recursive: true });
  }
};
