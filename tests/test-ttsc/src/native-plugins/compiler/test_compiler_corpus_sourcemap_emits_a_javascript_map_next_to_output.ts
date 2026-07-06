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
 * Verifies compiler corpus: `sourceMap: true` emits a `.js.map` file next to
 * the output JavaScript.
 *
 * Source maps are produced by the Go backend and written as a sibling of the
 * `.js` file. Pins the end-to-end contract through the CLI so the tsconfig
 * `sourceMap` option is not silently dropped between the JS shim and the Go
 * compiler invocation.
 *
 * 1. Create a CommonJS project with `compilerOptions.sourceMap: true`.
 * 2. Run `ttsc --emit`.
 * 3. Assert exit 0 and that `dist/main.js.map` exists on disk.
 */
export const test_compiler_corpus_sourcemap_emits_a_javascript_map_next_to_output =
  (): void => {
    const root = project.root();
    project.run(root);
  };
