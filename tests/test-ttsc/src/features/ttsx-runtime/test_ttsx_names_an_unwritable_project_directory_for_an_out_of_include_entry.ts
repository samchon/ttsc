import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { denyWrites, runsAsRoot } from "../../internal/read-only-directory";

/**
 * Verifies ttsx names the directory and the remedy when a project directory
 * refuses the temporary tsconfig an out-of-`include` entry needs.
 *
 * TypeScript-Go's command line cannot combine a project with a file list, so an
 * entry outside the project's file set is compiled through a tsconfig that
 * extends the project's and is written beside it for the length of the build;
 * only there do `${configDir}`, the default `typeRoots`, and `types` resolve as
 * they do for the project. A read-only checkout, mount, or volume refuses that
 * write. The run used to end on a bare `EPERM` naming a file the user never
 * created; it now says which directory and what to change, and an entry the
 * project includes still runs from the same directory.
 *
 * Root ignores directory permissions, so the case cannot hold there.
 *
 * 1. Create a project that includes `src` and an entry beside the tsconfig.
 * 2. Deny writes to the project directory, keeping the runtime cache elsewhere.
 * 3. Assert the out-of-include entry fails naming the directory and the remedy,
 *    and the included entry runs.
 */
export const test_ttsx_names_an_unwritable_project_directory_for_an_out_of_include_entry =
  () => {
    if (runsAsRoot()) return;
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "readonly", private: true }),
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
      "src/main.ts": `console.log("included-ran");\nexport {};\n`,
      "clear.ts": `console.log("outside-ran");\nexport {};\n`,
    });
    const cacheDir = TestProject.tmpdir("ttsx-readonly-cache-");
    const restore = denyWrites(root);
    try {
      const outside = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, "--cache-dir", cacheDir, "clear.ts"],
        { cwd: root },
      );
      assert.equal(outside.status, 2, outside.stdout);
      assert.match(outside.stderr, /is not writable/);
      assert.ok(
        outside.stderr.includes(fs.realpathSync.native(root)) ||
          outside.stderr.includes(root),
        outside.stderr,
      );
      assert.match(outside.stderr, /"include" or "files"/);
      assert.doesNotMatch(outside.stdout, /outside-ran/);

      const included = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
        { cwd: root },
      );
      assert.equal(included.status, 0, included.stderr);
      assert.equal(included.stdout.trim(), "included-ran");
    } finally {
      restore();
    }
  };
