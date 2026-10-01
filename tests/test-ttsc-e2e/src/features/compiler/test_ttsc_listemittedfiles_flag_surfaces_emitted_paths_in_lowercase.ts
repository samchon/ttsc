import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a lowercase `--listemittedfiles` surfaces the same listing as the
 * canonical spelling.
 *
 * Tsgo matches option names case-insensitively, so it emitted the `TSFILE:`
 * lines either way — but the launcher resolved flags by exact spelling, did not
 * recognise the variant as its own shadow flag, and stripped the listing back
 * out as internal noise. The user saw an empty stdout for a flag the compiler
 * had honoured. The case-variant twin of
 * `test_ttsc_listemittedfiles_flag_surfaces_emitted_paths`.
 *
 * 1. Create a minimal project.
 * 2. Run `ttsc --emit --listemittedfiles`.
 * 3. Assert a zero exit and a `TSFILE:` listing line in stdout.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs emit with --listemittedfiles and requires successful native TSFILE main.js listing.
 * @evidence contracts/testing.md#independent-expectations The compiler flag spelling is case-insensitive, while the authored main.ts determines the expected emitted basename independently.
 * @evidence contracts/testing.md#distinguishing-cases This lowercase spelling complements --listEmittedFiles, detecting normalization or host allowlist decisions that mishandle lowercase flags.
 * @evidence contracts/testing.md#execution-ownership The matching exported compiler feature runs actual launcher/native compiler through TestExecutor.
 * @evidence contracts/e2e.md#necessary-boundary Case-insensitive flag normalization must reach real compiler listing and stream delivery, not merely produce a normalized option object.
 * @evidence contracts/e2e.md#shared-execution One emit invocation supplies both checks; the built compiler and launcher are shared, and no native contributor is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh registered project/config prevent old emitted state from supplying the observation; synchronous child completion and suite-owned cleanup bound fixture lifetime.
 * @evidence contracts/e2e.md#preserved-coverage Original success and listing regex remain. This duplicate-spelling boundary remains a consolidation candidate if its actual forwarded spelling is retained in a shared batch.
 */
export const test_ttsc_listemittedfiles_flag_surfaces_emitted_paths_in_lowercase =
  () => {
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
      "src/main.ts": `export const value: string = "listed";\n`,
    });

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--listemittedfiles"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /TSFILE:.*main\.js/);
  };
