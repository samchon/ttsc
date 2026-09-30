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
 * Verifies compiler corpus: `--noEmit` blocks output writes even when sources
 * are valid.
 *
 * `--noEmit` is used by CI check-only passes that must not write artifacts.
 * Pins that the flag fully suppresses emission through the CLI even when the
 * TypeScript is clean; without this guard a codepath could treat `--noEmit` as
 * advisory and still write to `outDir`.
 *
 * 1. Create a valid CommonJS project.
 * 2. Run `ttsc --cwd <root> --noEmit`.
 * 3. Assert exit 0 and that `dist/main.js` was not written to disk.
 */
export const test_compiler_corpus_noemit_mode_blocks_output_writes_even_when_sources_are_valid =
  (): void => {
    const root = project.root();
    project.run(root);
  };
