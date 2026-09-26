import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a repeated `--diagnostics` takes the value of its last occurrence.
 *
 * TypeScript-Go assigns an option at every occurrence, so `--diagnostics false
 * --diagnostics true` prints timing and the reverse order does not. ttsc read
 * the first occurrence, so its own timing lines disagreed with the compiler's.
 * Plain-lane timing is printed by TypeScript-Go itself; ttsc adds its own
 * `ttsc` total only when it believes timing was requested.
 *
 * 1. Create a valid project.
 * 2. Run ttsc with `--diagnostics false --diagnostics true`, then with `true`
 *    followed by `false`.
 * 3. Assert the first prints timing and the second prints none.
 */
export const test_ttsc_diagnostics_flag_follows_the_last_occurrence = () => {
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
    "src/main.ts": `export const value: string = "timing";\n`,
  });

  const enabled = spawn(
    ttscBin,
    ["--cwd", root, "--diagnostics", "false", "--diagnostics", "true"],
    { cwd: root },
  );
  assert.equal(enabled.status, 0, enabled.stderr);
  assert.match(enabled.stdout + enabled.stderr, /Check time/i);

  const disabled = spawn(
    ttscBin,
    ["--cwd", root, "--diagnostics", "true", "--diagnostics", "false"],
    { cwd: root },
  );
  assert.equal(disabled.status, 0, disabled.stderr);
  assert.doesNotMatch(disabled.stdout + disabled.stderr, /time/i);
};
