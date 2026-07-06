import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "invalid tsconfig is rejected before emit",
  root: () =>
    createProject({
      "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,`,
      "src/main.ts": `console.log("invalid-config-should-not-emit");\n`,
    }),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unexpected end of JSON input|Expected/);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  },
};

/**
 * Verifies compiler corpus: a malformed tsconfig is rejected before any emit.
 *
 * A truncated JSON tsconfig (missing closing braces) must cause the compiler to
 * fail with a parse error before touching `outDir`. Without this guard a
 * corrupted tsconfig could silently fall back to default options and write
 * output to unexpected locations. Pins the early-rejection path so the project
 * directory stays clean on bad config.
 *
 * 1. Create a project with a truncated `tsconfig.json`.
 * 2. Run `ttsc --emit`.
 * 3. Assert non-zero exit, a JSON parse error on stderr, and no `dist/main.js`.
 */
export const test_compiler_corpus_invalid_tsconfig_is_rejected_before_emit =
  (): void => {
    const root = project.root();
    project.run(root);
  };
