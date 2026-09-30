import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "syntax diagnostics stop emit before JavaScript is written",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const broken = ;\n`,
    }),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Expression expected|Declaration or statement expected/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  },
};

/**
 * Verifies compiler corpus: a syntax error stops emit before JavaScript is
 * written.
 *
 * Complements the semantic-diagnostic guard by covering parse-phase errors. A
 * source file with invalid syntax (e.g. a bare `=` with no right-hand side)
 * must halt compilation and leave the `outDir` clean. Without this gate the
 * compiler could parse enough of the file to emit partial JavaScript.
 *
 * 1. Create a CommonJS project with a syntax error in `src/main.ts`.
 * 2. Run `ttsc --emit`.
 * 3. Assert non-zero exit, a syntax-error message on stderr, and no
 *    `dist/main.js`.
 */
export const test_compiler_corpus_syntax_diagnostics_stop_emit_before_javascript_is_written =
  (): void => {
    const root = project.root();
    project.run(root);
  };
