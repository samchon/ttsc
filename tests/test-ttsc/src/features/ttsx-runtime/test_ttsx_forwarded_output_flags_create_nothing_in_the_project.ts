import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * Verifies compiler flags that name output locations, forwarded before the
 * entry, never move ttsx's private build into the project.
 *
 * Pins samchon/ttsc#1404. A flag before the entry reaches the compiler after
 * the private `--outDir` ttsx injected, so `ttsx --outDir distx main.ts` wrote
 * the whole emit into `distx/` and ran only because a name match found it
 * there. Output-location flags may still shape the check, but every build ttsx
 * starts now puts all of its output in the run's own directory.
 *
 * 1. Create a project with `rootDir: "src"` and `outDir: "lib"`.
 * 2. Run the entry once per forwarded flag set: `--outDir`, `--declaration
 *    --declarationDir`, `--incremental --tsBuildInfoFile`, and `--outFile`.
 * 3. Assert each run prints the entry's output and leaves the project's file list
 *    unchanged.
 */
export const test_ttsx_forwarded_output_flags_create_nothing_in_the_project =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "forwarded", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          rootDir: "src",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `import { value } from "./value";`,
        `console.log(value);`,
        ``,
      ].join("\n"),
      "src/value.ts": `export const value: string = "ran";\n`,
    });
    const before = listProject(root);

    for (const flags of [
      ["--outDir", "distx"],
      ["--declaration", "--declarationDir", "typesx"],
      ["--incremental", "--tsBuildInfoFile", "state/run.tsbuildinfo"],
      ["--outFile", "bundle.js"],
    ]) {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, ...flags, "src/main.ts"],
        { cwd: root },
      );
      const label = flags.join(" ");
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), "ran", label);
      assert.deepEqual(
        listProject(root),
        before,
        `${label} wrote into the project`,
      );
    }
  };

/** Top-level entries of the project, minus `node_modules`. */
function listProject(root: string): string[] {
  return fs
    .readdirSync(root)
    .filter((name) => name !== "node_modules")
    .sort();
}
