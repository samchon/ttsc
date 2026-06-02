import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs an entry project whose tsconfig sets neither `rootDir` nor
 * `outDir`.
 *
 * Ttsx always injects its own `--outDir` (the per-run byte store), and tsgo
 * rejects an `outDir` without an explicit `rootDir` (TS5011). A project that is
 * meant to be run rather than built commonly configures neither key, so the
 * gate must supply a `rootDir` itself instead of failing the whole compile. A
 * regression that tied the supplied `rootDir` to the project also declaring an
 * `outDir` would abort this project before it ever ran.
 *
 * 1. Create a project whose tsconfig declares neither `rootDir` nor `outDir`.
 * 2. Run ttsx against an entry that imports a sibling source.
 * 3. Assert the process exits zero and prints the expected output.
 */
export const test_ttsx_runs_an_entry_project_without_rootdir_or_outdir = () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
      },
      include: ["src"],
    }),
    "src/value.ts": `export const value: string = "no-output-keys-ok";\n`,
    "src/main.ts": `import { value } from "./value";\nconsole.log(value);\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "no-output-keys-ok");
};
