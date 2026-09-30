import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc check resolves `paths` mappings under current TypeScript-Go
 * policy.
 *
 * The Go compiler tracks TypeScript-Go's evolving `paths` resolution policy.
 * Both wildcard (`@lib/*`) and exact-match (`exact-lib`) aliases must resolve
 * during the check phase. This test is intentionally written as a clean-pass
 * assertion so CI will catch any regression where the Go backend silently stops
 * resolving `paths` aliases in a newer tsgo version.
 *
 * 1. Create a project with `paths` aliases and source files that import via those
 *    aliases.
 * 2. Run `ttsc check`.
 * 3. Assert exit 0 (no type errors from unresolved paths).
 *
 * @evidence contracts/testing.md#behavioral-verification The actual ttsc check command must succeed on imports through wildcard @lib/* and exact exact-lib path mappings, exposing dropped path configuration at the native check boundary.
 * @evidence contracts/testing.md#independent-expectations Both mappings name real fixture modules under lib and the source uses their exported values. Exit zero requires resolution without diagnostics; this positive-only oracle does not independently prove retained literal type specificity, for which a mistyped consumer twin would be stronger.
 * @evidence contracts/testing.md#distinguishing-cases Wildcard and exact aliases coexist in one plugin-free valid source. The alias-overlay tests own bad type assignments through generated wrappers; this entry owns the direct check-subcommand path.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_check_resolves_paths_mappings_under_current_typescript_go_policy in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by TestSourceUnits.
 * @evidence contracts/e2e.md#necessary-boundary Public check dispatch reaches actual TypeScript-Go resolution of consumer paths. A unit mapping parser cannot show the checker loads both fixture targets from the selected config.
 * @evidence contracts/e2e.md#shared-execution One uniquely allocated consumer and the repository-built launcher/native compiler artifacts serve this entry. No plugin installation or contributor build occurs; the child process is required to exercise public command dispatch and returns synchronously with captured status/streams.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_check_resolves_paths_mappings_under_current_typescript_go_policy. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_check_resolves_paths_mappings_under_current_typescript_go_policy =
  () => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          paths: {
            "@lib/*": ["./lib/*"],
            "exact-lib": ["./lib/exact.ts"],
          },
        },
        include: ["src", "lib"],
      }),
      "lib/exact.ts": `export const exact = "exact" as const;\n`,
      "lib/tool.ts": `export const tool = "tool" as const;\n`,
      "src/main.ts": `
      import { exact } from "exact-lib";
      import { tool } from "@lib/tool";
      export const joined: string = exact + ":" + tool;
    `,
    });

    const result = spawn(ttscBin, ["check", "--cwd", root], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
  };
