import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies positional `ttsc <file.ts>` compiles a nested source in a project
 * that declares no `rootDir`, and writes that file's own output.
 *
 * Single-file mode compiles the whole project into a private temp directory and
 * copies one result out, so it injects an `outDir` the project never declared —
 * the same injection that makes tsgo demand an explicit layout (TS5011) and
 * refuse the build. Once the build is allowed, the copied file must still be
 * the requested one: the lookup mirrors the source's position under the pinned
 * root, and a root that missed would leave the trailing-stem matcher to choose
 * between two same-named outputs (issue #1172).
 *
 * 1. Build a project with no `outDir` and no `rootDir` holding two sources named
 *    `main.ts` in different directories.
 * 2. Run `ttsc src/main.ts`.
 * 3. Assert the sibling's output was not written and `src/main.js` carries the
 *    requested file's own value.
 */
export const test_ttsc_single_file_emits_a_nested_source_whose_project_declares_no_rootdir =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value: string = "requested-entry";\n`,
        "src/other/main.ts": `export const value: string = "sibling-entry";\n`,
      },
      {
        compilerOptions: {
          outDir: undefined,
          rootDir: undefined,
        },
      },
    );

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const emitted = path.join(root, "src", "main.js");
    assert.equal(
      fs.existsSync(emitted),
      true,
      `${result.stdout}${result.stderr}`,
    );
    assert.match(fs.readFileSync(emitted, "utf8"), /requested-entry/);
    assert.doesNotMatch(fs.readFileSync(emitted, "utf8"), /sibling-entry/);
    assert.equal(
      fs.existsSync(path.join(root, "src", "other", "main.js")),
      false,
      "single-file mode wrote a file it was not asked for",
    );
  };
