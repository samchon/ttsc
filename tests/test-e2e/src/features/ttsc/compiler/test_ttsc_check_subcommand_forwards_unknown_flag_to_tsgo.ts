import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies `ttsc check` forwards an unrecognized flag to tsgo (RC-1).
 *
 * `ttsc check --strict` must travel `--strict` through to tsgo just like `ttsc
 * --strict` does on the bare lane. Before the flag-schema cutover the `check`
 * subcommand routed through a parallel parser branch that could silently drop a
 * flag the bare-lane parser accepted; the new schema declares every flag's
 * `consumedBy` set once and the subcommand branch reuses the same engine, so a
 * flag with `forwardTo: "tsgo"` reaches tsgo regardless of which subcommand the
 * user typed. The fixture's tsconfig sets `strict: false`, so the strict-null
 * diagnostic can only surface if `--strict` actually reached tsgo.
 *
 * 1. Create a project whose tsconfig disables strict mode, with a source file that
 *    dereferences a possibly-null value.
 * 2. Run `ttsc check --strict src/main.ts`.
 * 3. Assert non-zero exit and the strict-null diagnostic in the output.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc check --strict src/main.ts must fail with the possibly-null diagnostic on source dereferencing string|null, despite the fixture tsconfig disabling strict. This exposes check dispatch dropping a forwardable strict flag.
 * @evidence contracts/testing.md#independent-expectations The explicit strict argument requires null checking of x.length, independently of ttsc's forwarding schema. Literal nonzero status and null diagnostic require semantic compiler execution, rather than inspection of constructed arguments.
 * @evidence contracts/testing.md#distinguishing-cases The check subcommand with explicit source filename and strict forwarding is this variant. There is no same-entry invocation omitting --strict, so native defaults for explicit file arguments are an oracle limitation; parser units own flag normalization.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_check_subcommand_forwards_unknown_flag_to_tsgo in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by the unit-module executor.
 * @evidence contracts/e2e.md#necessary-boundary The launcher check dispatch must assemble real compiler arguments whose semantic effect is visible in the native null diagnostic. Unit flag parsing cannot establish that child invocation.
 * @evidence contracts/e2e.md#shared-execution One uniquely allocated consumer and the repository-built launcher/native compiler artifacts serve this entry. No plugin installation or contributor build occurs; the child process is required to exercise public command dispatch and returns synchronously with captured status/streams.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_check_subcommand_forwards_unknown_flag_to_tsgo. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_check_subcommand_forwards_unknown_flag_to_tsgo = () => {
  const root = createProject(FixtureFiles.read("ttsc/ttsc_check_subcommand_forwards_unknown_flag_to_tsgo/inputs-1"));

  const result = spawn(
    ttscBin,
    ["check", "--cwd", root, "--strict", "src/main.ts"],
    { cwd: root },
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /is possibly .?null/i);
};
