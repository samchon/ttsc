import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx runs a check-only project whose sources sit under `src` and
 * whose tsconfig declares no `rootDir`.
 *
 * The runner emits into a PID-isolated temp directory, and that injected
 * `outDir` is what makes tsgo demand an explicit layout (TS5011) from a project
 * that declares no output at all — the same project `tsgo -p .`, `ttsc`, and
 * `ttsc --emit` all accept. ttsx answers the demand by pinning the root tsgo
 * itself infers, so a nested import must still resolve through the mirrored
 * emit and no JavaScript may appear beside the sources: a root that missed by
 * one directory would put the inputs outside it, and tsgo writes an input
 * outside `rootDir` to its own source path (issue #1172).
 *
 * 1. Build a `noEmit` project with sources under `src/` and no `rootDir`.
 * 2. Run ttsx against `src/main.ts`, which imports `src/lib/greeting.ts`.
 * 3. Assert the program printed the imported value and left no `.js` on disk.
 */
export const test_ttsx_runs_a_nested_entry_whose_project_declares_no_rootdir =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/lib/greeting.ts": `export const greeting: string = "no-rootdir-nested";\n`,
        "src/main.ts": [
          `import { greeting } from "./lib/greeting";`,
          ``,
          `console.log(greeting);`,
          ``,
        ].join("\n"),
      },
      {
        compilerOptions: {
          // The shape the issue reports: output is never configured, so the
          // project has no layout to declare.
          noEmit: true,
          outDir: undefined,
          rootDir: undefined,
        },
      },
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(result.stdout.trim(), "no-rootdir-nested");
    for (const leaked of [
      path.join(root, "src", "main.js"),
      path.join(root, "src", "lib", "greeting.js"),
    ]) {
      assert.equal(
        fs.existsSync(leaked),
        false,
        `the runtime emit escaped into the source tree at ${leaked}`,
      );
    }
  };
