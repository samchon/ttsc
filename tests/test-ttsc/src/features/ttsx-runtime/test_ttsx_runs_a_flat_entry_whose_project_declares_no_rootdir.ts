import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx still runs a flat project that declares no `rootDir`, with its
 * emit still out of the source tree.
 *
 * This is the layout one property away from the nested case: the entry sits
 * beside the tsconfig, so the source root ttsx publishes and the root tsgo
 * infers were already the same directory, and this project ran before the
 * TS5011 fix. Pinning that root must therefore change nothing here — the case
 * exists to catch a synthesized root that moves an emit the compiler had
 * already been placing correctly (issue #1172).
 *
 * 1. Build a `noEmit` project whose only source sits beside the tsconfig, with no
 *    `rootDir`.
 * 2. Run ttsx against `main.ts`.
 * 3. Assert the program ran and left no `.js` beside its source.
 */
export const test_ttsx_runs_a_flat_entry_whose_project_declares_no_rootdir =
  () => {
    const root = TestProject.commonJsProject(
      {
        "helper.ts": `export const helper: string = "no-rootdir-flat";\n`,
        "main.ts": [
          `import { helper } from "./helper";`,
          ``,
          `console.log(helper);`,
          ``,
        ].join("\n"),
      },
      {
        compilerOptions: {
          noEmit: true,
          outDir: undefined,
          rootDir: undefined,
        },
        config: { include: ["*.ts"] },
      },
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(result.stdout.trim(), "no-rootdir-flat");
    for (const leaked of [
      path.join(root, "main.js"),
      path.join(root, "helper.js"),
    ]) {
      assert.equal(
        fs.existsSync(leaked),
        false,
        `the runtime emit escaped into the source tree at ${leaked}`,
      );
    }
  };
