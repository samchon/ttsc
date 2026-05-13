import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "noEmit mode blocks output writes even when sources are valid",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value: string = "noemit";\n`,
    }),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  },
};

/**
 * Verifies compiler corpus: noEmit mode blocks output writes even when sources
 * are valid.
 *
 * This ttsc compiler corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_compiler_corpus_noemit_mode_blocks_output_writes_even_when_sources_are_valid =
  (): void => {
    const root = project.root();
    project.run(root);
  };
