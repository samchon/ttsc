import {
  assert,
  commonJsProject,
  fs,
  path,
  runNode,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "single file compatibility mode writes to explicit outDir",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value: number = 7;\nconsole.log(value.toString());\n`,
    }),
  run(root: string) {
    const result = spawn(
      ttscBin,
      ["--cwd", root, "--outDir", "single", "src/main.ts"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const output = path.join(root, "single", "src", "main.js");
    assert.equal(fs.existsSync(output), true);
    const run = runNode(output, { cwd: root });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "7");
  },
};

/**
 * Verifies compiler corpus: single file compatibility mode writes to explicit
 * outDir.
 *
 * This ttsc compiler corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_compiler_corpus_single_file_compatibility_mode_writes_to_explicit_outdir =
  (): void => {
    const root = project.root();
    project.run(root);
  };
