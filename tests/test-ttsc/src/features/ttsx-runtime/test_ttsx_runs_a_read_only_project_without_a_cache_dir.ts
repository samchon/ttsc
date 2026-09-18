import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { denyWrites, runsAsRoot } from "../../internal/read-only-directory";

/**
 * Verifies ttsx runs an included entry of a project whose directory refuses
 * writes, without being told where to cache.
 *
 * With no `--cache-dir`, the runtime output goes below the project's own
 * `node_modules/.cache/ttsc/ttsx`. A read-only checkout, mount, or container
 * filesystem refuses that directory, and the run ended on a bare `EPERM` before
 * anything compiled. Each run writes into a directory of its own and removes it
 * on exit, so any writable parent serves: the default falls back to one below
 * the system temp directory, and the project is left exactly as it was.
 *
 * Root ignores directory permissions, so the case cannot hold there.
 *
 * 1. Create a project with an included entry.
 * 2. Deny writes to the project directory and run the entry without `--cache-dir`.
 * 3. Assert the entry ran and the project directory gained nothing.
 */
export const test_ttsx_runs_a_read_only_project_without_a_cache_dir = () => {
  if (runsAsRoot()) return;
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "readonlycache", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        types: [],
      },
      include: ["src"],
    }),
    "src/main.ts": `console.log("read-only-ran");\nexport {};\n`,
  });
  const before = fs.readdirSync(root).sort();
  const restore = denyWrites(root);
  try {
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "read-only-ran");
  } finally {
    restore();
  }
  assert.deepEqual(fs.readdirSync(root).sort(), before);
};
