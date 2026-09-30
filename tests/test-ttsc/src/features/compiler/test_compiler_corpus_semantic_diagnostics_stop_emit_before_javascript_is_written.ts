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
 * Verifies compiler corpus: a semantic type error stops emit before JavaScript
 * is written.
 *
 * Pins the semantic-gating behavior: when a type error exists (e.g. `string`
 * assigned to `number`), the CLI must report the error and exit non-zero
 * without producing any output file. Without this guard the Go backend could
 * emit partial output and leave a corrupt `dist/` tree for the next build.
 *
 * 1. Create a CommonJS project with a type error in `src/main.ts`.
 * 2. Run `ttsc --emit`.
 * 3. Assert non-zero exit, the type-error message on stderr, and no
 *    `dist/main.js`.
 */
export const test_compiler_corpus_semantic_diagnostics_stop_emit_before_javascript_is_written =
  (): void => {
    const root = project.root();
    project.run(root);
  };
