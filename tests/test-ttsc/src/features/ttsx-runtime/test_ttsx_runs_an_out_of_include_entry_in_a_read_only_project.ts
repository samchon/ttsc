import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { denyWrites, runsAsRoot } from "../../internal/read-only-directory";

/**
 * Verifies ttsx runs an out-of-`include` entry in a project whose directory
 * refuses writes, with every option of that project.
 *
 * TypeScript-Go's command line cannot combine a project with a file list, and
 * ttsx used to compile such an entry through a tsconfig written beside the
 * project's own for the length of the build, because only there do
 * `${configDir}`, the default `typeRoots`, and `types` resolve as they do for
 * the project. A read-only checkout, mount, or volume refused that write, and
 * the entry could not run at all. The project's config is now parsed where it
 * lives with only its file list replaced in memory, so the directory is never
 * written. The entry is type-checked, and its type import resolves only through
 * a `${configDir}` alias read in place; the included entry is the twin that
 * always ran.
 *
 * Root ignores directory permissions, so the case cannot hold there.
 *
 * 1. Create a project that includes `src`, with an entry beside the tsconfig
 *    that imports a type from `src` through a `${configDir}` path alias.
 * 2. Deny writes to the project directory, keeping the runtime cache elsewhere.
 * 3. Assert the out-of-include entry and the included entry both run, and the
 *    directory holds what it held before.
 */
export const test_ttsx_runs_an_out_of_include_entry_in_a_read_only_project =
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
          paths: { "#src/*": ["${configDir}/src/*"] },
        },
        include: ["src"],
      }),
      "src/main.ts": `console.log("included-ran");\nexport {};\n`,
      "src/message.ts": `export type Message = string;\n`,
      "clear.ts": [
        `import type { Message } from "#src/message";`,
        `const message: Message = "outside-ran";`,
        `console.log(message);`,
        ``,
      ].join("\n"),
    });
    const cacheDir = TestProject.tmpdir("ttsx-readonly-cache-");
    const before = fs.readdirSync(root).sort();
    const restore = denyWrites(root);
    try {
      const outside = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, "--cache-dir", cacheDir, "clear.ts"],
        { cwd: root },
      );
      assert.equal(outside.status, 0, outside.stderr);
      assert.equal(outside.stdout.trim(), "outside-ran");

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
    assert.deepEqual(fs.readdirSync(root).sort(), before);
  };
