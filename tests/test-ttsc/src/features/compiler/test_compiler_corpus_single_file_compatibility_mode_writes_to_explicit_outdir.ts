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
 * Verifies compiler corpus: single-file compatibility mode writes to an
 * explicit `--outDir` when provided.
 *
 * When `--outDir` is supplied alongside a positional file argument, the emitted
 * JS must land in `<outDir>/<source-relative-path>` rather than next to the
 * source file. Pins the `--outDir` override path in single-file mode so scripts
 * that need to direct output elsewhere can do so without editing the tsconfig.
 *
 * 1. Materialize a CommonJS project with a configured `outDir: dist` in tsconfig.
 * 2. Run `ttsc --outDir single src/main.ts`.
 * 3. Assert `single/src/main.js` is written and executes successfully.
 */
export const test_compiler_corpus_single_file_compatibility_mode_writes_to_explicit_outdir =
  (): void => {
    const root = project.root();
    project.run(root);
  };
