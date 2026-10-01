import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies ttsc forwards an unrecognized flag to the underlying tsgo binary.
 *
 * Ttsc owns a fixed set of CLI flags and deliberately does not re-implement
 * tsgo's option table; every other flag must reach tsgo so `ttsc --strict
 * file.ts` behaves like `tsgo --strict file.ts`. The fixture's tsconfig sets
 * `strict: false`, so a strict-null diagnostic can only appear if `--strict`
 * actually travelled through to tsgo and overrode the project setting.
 *
 * 1. Create a project whose tsconfig disables strict mode, with a source file that
 *    dereferences a possibly-null value.
 * 2. Run `ttsc --strict <file>`.
 * 3. Assert a non-zero exit and the strict-null diagnostic in the output.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs the ttsc single-file launcher with --strict overriding a nonstrict project and requires failure plus the nullable-member diagnostic.
 * @evidence contracts/testing.md#independent-expectations The authored string|null dereference is legal under the fixture nonstrict setting and invalid with forwarded strict checking; that semantic difference supplies an independent oracle.
 * @evidence contracts/testing.md#distinguishing-cases The stricter CLI value must override config rather than be rejected as unknown by ttsc or ignored. Other argv arity cases have separate entries.
 * @evidence contracts/testing.md#execution-ownership The matching compiler feature export is discovered by TestExecutor and launches the actual ttsc/tsgo command chain.
 * @evidence contracts/e2e.md#necessary-boundary Unknown-to-host compiler flags must cross launcher forwarding into real compiler checking; a pure argv parser cannot prove the consumer applies strictness.
 * @evidence contracts/e2e.md#shared-execution One launcher process runs one invalid source and supplies status/diagnostic checks; suite-built launcher and compiler are shared, with no plugin build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject registers a fresh config/source fixture. Synchronous spawn completes before assertions and TestProject cleanup releases the root at suite exit.
 * @evidence contracts/e2e.md#preserved-coverage Original nonzero and nullable-diagnostic assertions remain. This case does not require a particular numeric diagnostic code or full diagnostic list.
 */
export const test_ttsc_forwards_an_unknown_flag_to_tsgo = () => {
  const root = createProject(FixtureFiles.read("ttsc/ttsc_forwards_an_unknown_flag_to_tsgo/inputs-1"));

  const result = spawn(ttscBin, ["--cwd", root, "--strict", "src/main.ts"], {
    cwd: root,
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /is possibly .?null/i);
};
