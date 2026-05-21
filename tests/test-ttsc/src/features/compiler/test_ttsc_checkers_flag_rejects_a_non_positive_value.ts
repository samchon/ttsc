import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc --checkers` rejects a non-positive checker count.
 *
 * Tsgo declares `--checkers` with `minValue: 1`. ttsc mirrors that in its
 * launcher so a typo like `--checkers 0` fails loudly up front instead of
 * silently building with the default pool. Pins the `parseCheckersValue` guard
 * in the build-argument parser.
 *
 * 1. Create a project with a valid TypeScript source file.
 * 2. Run `ttsc --checkers 0`.
 * 3. Assert a non-zero exit and a "positive integer" message on stderr.
 */
export const test_ttsc_checkers_flag_rejects_a_non_positive_value = () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export const answer: number = 42;\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--checkers", "0"], {
    cwd: root,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--checkers expects a positive integer/);
};
