import {
  assert,
  createProject,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc clean` accepts tsgo passthrough flags (RC-3 + RC-4).
 *
 * Before the flag-schema cutover, project subcommands ran through a completely
 * separate parser branch from the build-lane parser: it rejected every unknown
 * flag with `throw new Error("unknown option")`, so a user habituated to `ttsc
 * --strict` would hit a hard exit on `ttsc clean --strict tsconfig.json`. The
 * new schema routes every subcommand through one engine, and `clean` declares
 * `--strict` as forwardable like every other subcommand. Even though `clean`
 * does not actually use `--strict`, it must not reject it as an unknown option
 * — the consistency across subcommands is the point.
 *
 * 1. Create a minimal project with a tsconfig.
 * 2. Run `ttsc clean --strict --tsconfig &lt;path&gt;`.
 * 3. Assert zero exit and no "unknown option" error in the output.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual clean subcommand with --strict and --tsconfig tsconfig.json must exit zero and produce no unknown-option/command message, detecting its formerly separate parser rejection branch.
 * @evidence contracts/testing.md#independent-expectations Strict is an accepted passthrough spelling even though cleanup does not use its checker meaning. Literal successful exit and absent rejection independently pin public acceptance; no deletion assertion is claimed by this entry.
 * @evidence contracts/testing.md#distinguishing-cases Recognized clean dispatch carries a compiler-owned flag and a config path. The clean-cache-ownership entry owns deletion behavior, while check forwarding owns a flag's actual semantic effect.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_clean_subcommand_does_not_reject_tsgo_passthrough in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by TestSourceUnits.
 * @evidence contracts/e2e.md#necessary-boundary The real launcher must dispatch clean through the shared public argument surface without rejecting recognized passthrough. A parser unit alone does not show the command-specific dispatcher preserves acceptance.
 * @evidence contracts/e2e.md#shared-execution One consumer and built JS launcher serve one exited clean child; no native compiler or Go build is invoked. The already built launcher is shared with other CLI boundary cases.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture root and cache-home are unique; all platform home/cache variables are overridden only in the child so cleanup cannot reach developer caches. No parent environment is mutated. The exited child retains no process handle and TestProject owns temporary cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_clean_subcommand_does_not_reject_tsgo_passthrough. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_clean_subcommand_does_not_reject_tsgo_passthrough =
  () => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: false,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": `export const x = 1;\n`,
    });

    // Isolate the machine cache locations so clean's pre-0.17 legacy-global
    // cache reclamation cannot touch the real developer cache when run locally.
    const home = path.join(root, "cache-home");
    const result = spawn(
      ttscBin,
      ["clean", "--cwd", root, "--strict", "--tsconfig", "tsconfig.json"],
      {
        cwd: root,
        env: {
          HOME: home,
          USERPROFILE: home,
          XDG_CACHE_HOME: path.join(home, ".cache"),
          LOCALAPPDATA: path.join(home, "AppData", "Local"),
        },
      },
    );

    assert.equal(
      result.status,
      0,
      `stderr=${result.stderr}\nstdout=${result.stdout}`,
    );
    assert.doesNotMatch(
      `${result.stdout}${result.stderr}`,
      /unknown (option|command)/i,
    );
  };
