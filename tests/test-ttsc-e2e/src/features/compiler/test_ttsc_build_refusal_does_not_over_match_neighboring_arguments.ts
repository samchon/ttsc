import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies the `--build` refusal claims only `--build` / `-b`.
 *
 * The launcher resolves a flag by identity — dashes stripped, lower-cased — so
 * a refusal keyed on that identity is one normalization away from swallowing
 * every neighbouring spelling: the dash-less `build` subcommand, an unknown
 * flag that merely starts with the same letters, and the schema's own
 * build-named passthrough flag with its value token. Each of those must keep
 * the behaviour it had before ttsc learned to refuse solution mode.
 *
 * 1. Materialize a single-project fixture that emits into `dist`.
 * 2. Run the bare `build` subcommand, an unknown `--buildish` flag, and
 *    `--incremental --tsBuildInfoFile <path>`.
 * 3. Assert the subcommand and the forwarded pair still build, `--buildish` still
 *    reaches tsgo's unknown-option diagnostic, and none of the three prints
 *    ttsc's solution-mode refusal.
 *
 * @evidence contracts/testing.md#behavioral-verification The launcher must build via bare build, accept incremental/tsBuildInfoFile passthrough, and reject unknown --buildish naming that option, with none printing solution-mode refusal. First invocation must actually emit main.js.
 * @evidence contracts/testing.md#independent-expectations Literal neighboring spellings are distinct from unsupported --build/-b solution mode. Exit statuses, freshly emitted JS and absence of the refusal message independently distinguish public dispatch; the unknown assertion names buildish but does not pin an exact diagnostic code.
 * @evidence contracts/testing.md#distinguishing-cases Bare subcommand, supported build-info operand pair and prefix-sharing unknown option test different normalization boundaries. Exact forbidden solution-mode identities are owned by their separate refusal entry.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_build_refusal_does_not_over_match_neighboring_arguments in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by the unit-module executor.
 * @evidence contracts/e2e.md#necessary-boundary The real launcher schema routes subcommand and forwarded flags to actual tsgo; parser identity calls cannot prove this command assembly reaches successful emit or the compiler's unknown-option result.
 * @evidence contracts/e2e.md#shared-execution One uniquely allocated consumer and the repository-built launcher/native compiler artifacts serve this entry. No plugin installation or contributor build occurs; the child process is required to exercise public command dispatch and returns synchronously with captured status/streams. Three exited child processes share the same valid consumer; changed command vectors require distinct public dispatches but no new fixture build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_build_refusal_does_not_over_match_neighboring_arguments. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_build_refusal_does_not_over_match_neighboring_arguments =
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
      "src/main.ts": `export const value = 1;\n`,
    });

    const subcommand = spawn(ttscBin, ["build", "--cwd", root], { cwd: root });
    assert.equal(
      subcommand.status,
      0,
      `${subcommand.stdout}${subcommand.stderr}`,
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), true);
    assert.doesNotMatch(subcommand.stderr, /solution mode/);

    const forwarded = spawn(
      ttscBin,
      [
        "--cwd",
        root,
        "--incremental",
        "--tsBuildInfoFile",
        "dist/app.tsbuildinfo",
      ],
      { cwd: root },
    );
    assert.equal(forwarded.status, 0, `${forwarded.stdout}${forwarded.stderr}`);
    assert.doesNotMatch(forwarded.stderr, /solution mode/);

    const unknown = spawn(ttscBin, ["--cwd", root, "--buildish"], {
      cwd: root,
    });
    const unknownOutput = `${unknown.stdout}${unknown.stderr}`;
    assert.notEqual(unknown.status, 0);
    assert.match(unknownOutput, /buildish/i);
    assert.doesNotMatch(unknownOutput, /solution mode/);
  };
