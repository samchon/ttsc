import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc rejects the `transform` command as unsupported.
 *
 * `transform` was a sub-command in earlier CLI drafts but was removed before
 * the public release. Pins that a user who types `ttsc transform` receives a
 * clear "unknown command" error rather than being silently treated as a project
 * path or falling through to the default build action.
 *
 * 1. Create a project with a valid TypeScript source file.
 * 2. Run `ttsc transform --cwd <root>`.
 * 3. Assert non-zero exit and an `unknown command "transform"` message on stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs transform on a valid jsconfig project and requires nonzero exit with unknown command transform.
 * @evidence contracts/testing.md#independent-expectations The public CLI does not expose transform as a subcommand; the valid authored config/source rule out missing-project failure as the intended outcome.
 * @evidence contracts/testing.md#distinguishing-cases This unknown-command negative contrasts with supported API transform and the separately rejected fix/watch pairing.
 * @evidence contracts/testing.md#execution-ownership The named compiler feature is discovered by TestExecutor and launches the real CLI.
 * @evidence contracts/e2e.md#necessary-boundary Actual command admission must report rejection and terminate before attempting a native transform; static command-table checks cannot prove that behavior.
 * @evidence contracts/e2e.md#shared-execution One rejected command supplies both checks using the built launcher; it requires no Go producer or independent installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh registered jsconfig project determines cwd/discovery context; synchronous launch ends before assertions and TestProject owns fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original nonzero and specific unknown-command error remain. Exact exit code and every unknown-command spelling are not asserted.
 */
export const test_ttsc_rejects_unsupported_transform_command = () => {
  const root = createProject({
    "jsconfig.json": JSON.stringify({
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

  const result = spawn(ttscBin, ["transform", "--cwd", root], { cwd: root });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown command "transform"/);
};
