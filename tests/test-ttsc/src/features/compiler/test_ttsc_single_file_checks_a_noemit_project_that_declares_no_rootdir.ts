import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies positional `ttsc <file.ts>` type-checks a `noEmit` project that
 * declares no `rootDir` without writing anything.
 *
 * This is the exact command the issue reports failing with TS5011 and exit 2.
 * Single-file mode always emits into its private temp directory — even for a
 * `noEmit` project, because that is how it obtains the transformed text — so
 * the injected `outDir` reaches tsgo either way, while `noEmit` still decides
 * whether anything is copied into the user's tree. Both halves have to hold at
 * once: exit 0, and not one file written (issue #1172).
 *
 * 1. Build a `noEmit` project with a nested source and no `rootDir`.
 * 2. Run `ttsc src/main.ts`.
 * 3. Assert the run succeeded and no JavaScript reached the source tree.
 */
export const test_ttsc_single_file_checks_a_noemit_project_that_declares_no_rootdir =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value: string = "check-only";\n`,
      },
      {
        compilerOptions: {
          noEmit: true,
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
    assert.equal(
      fs.existsSync(path.join(root, "src", "main.js")),
      false,
      "a noEmit project wrote JavaScript into its source tree",
    );
  };
