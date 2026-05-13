import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "semantic diagnostics stop emit before JavaScript is written",
  root: () =>
    commonJsProject({
      "src/main.ts": `const value: string = 123;\nconsole.log(value);\n`,
    }),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Type 'number' is not assignable to type 'string'/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  },
};

/**
 * Verifies compiler corpus: semantic diagnostics stop emit before JavaScript is
 * written.
 *
 * This ttsc compiler corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_compiler_corpus_semantic_diagnostics_stop_emit_before_javascript_is_written =
  (): void => {
    const root = project.root();
    project.run(root);
  };
