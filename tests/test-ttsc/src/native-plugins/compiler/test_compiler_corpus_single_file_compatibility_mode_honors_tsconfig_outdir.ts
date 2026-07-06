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
  name: "single file compatibility mode honors tsconfig outDir",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value: number = 7;\nconsole.log(value.toString());\n`,
    }),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);

    // tsconfig has outDir=dist + rootDir=src, so the emitted JS lands at
    // dist/main.js — NOT src/main.js next to the source.
    const expected = path.join(root, "dist", "main.js");
    const stale = path.join(root, "src", "main.js");
    assert.equal(
      fs.existsSync(expected),
      true,
      `expected emit at ${expected}, stdout=${result.stdout}`,
    );
    assert.equal(
      fs.existsSync(stale),
      false,
      `no JS should be dropped next to src/main.ts, but found ${stale}`,
    );

    const run = runNode(expected, { cwd: root });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "7");
  },
};

/**
 * Verifies compiler corpus: single file compatibility mode honors tsconfig
 * outDir.
 *
 * Pins the contract that `ttsc <file.ts>` without `--outDir` emits to the
 * tsconfig's `outDir` (mirroring the rootDir → outDir layout), instead of
 * dropping the JS next to the TS source. Regression for the long-standing
 * complaint that single-file invocations like `ttsc src/main.ts` leaked
 * `src/main.js` siblings even when the project clearly configured `outDir`.
 *
 * 1. Materialize a CommonJS fixture with rootDir=src and outDir=dist.
 * 2. Run `ttsc src/main.ts` with no `--outDir` override.
 * 3. Assert the emit lands at `dist/main.js` and that `src/main.js` is absent.
 */
export const test_compiler_corpus_single_file_compatibility_mode_honors_tsconfig_outdir =
  (): void => {
    const root = project.root();
    project.run(root);
  };
