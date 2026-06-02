import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs a project without `rootDir` whose entry imports sibling
 * source directories.
 *
 * When `rootDir` is absent, tsgo may emit relative to a common source directory
 * narrower than the project root. The runtime must still treat every project
 * source as part of the entry compile gate; otherwise an entry under `src/app/`
 * importing `src/shared/` is misclassified as an external dependency and can
 * fail in projects without a package manifest.
 *
 * 1. Create a project with no `rootDir` and sources under sibling directories.
 * 2. Run `ttsx` against the nested entry.
 * 3. Assert the sibling source import executes from the gate emit.
 */
export const test_ttsx_runs_a_project_without_root_dir_that_imports_sibling_source_directories =
  () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
        },
        include: ["src"],
      }),
      "src/app/main.ts":
        `import { value } from "../shared/value";\n` + `console.log(value);\n`,
      "src/shared/value.ts": `export const value: string = "sibling-source-ok";\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/app/main.ts"],
      {
        cwd: root,
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "sibling-source-ok");
  };
