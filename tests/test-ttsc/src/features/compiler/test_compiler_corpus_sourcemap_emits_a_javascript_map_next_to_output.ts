import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "sourceMap emits a JavaScript map next to output",
  root: () =>
    commonJsProject(
      {
        "src/main.ts": `export const mapped = () => "map";\n`,
      },
      {
        compilerOptions: {
          sourceMap: true,
        },
      },
    ),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js.map")), true);
  },
};

/**
 * Verifies compiler corpus: sourceMap emits a JavaScript map next to output.
 *
 * This ttsc compiler corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_compiler_corpus_sourcemap_emits_a_javascript_map_next_to_output =
  (): void => {
    const root = project.root();
    project.run(root);
  };
