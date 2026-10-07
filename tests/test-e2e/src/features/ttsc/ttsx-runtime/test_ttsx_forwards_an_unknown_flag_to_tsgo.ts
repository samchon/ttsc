import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { FixtureFiles } from "../../../internal/FixtureFiles";

/**
 * Verifies ttsx forwards an unrecognized flag to the tsgo type-check.
 *
 * Ttsx type-checks the project before running the entry. Like the `ttsc`
 * launcher, it owns a fixed set of flags and forwards every other flag (before
 * the entry) to tsgo rather than rejecting it — so `ttsx --strict src/main.ts`
 * behaves like the equivalent tsgo invocation. The fixture's tsconfig sets
 * `strict: false`, so a strict-null diagnostic can only appear if `--strict`
 * actually reached the type-check.
 *
 * 1. Create a project whose tsconfig disables strict mode, with a source file that
 *    dereferences a possibly-null value.
 * 2. Run `ttsx --strict src/main.ts`.
 * 3. Assert a non-zero exit and the strict-null diagnostic in stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification Ttsx receives --strict over a strict:false project and must exit nonzero with an is possibly null diagnostic for x.length.
 * @evidence contracts/testing.md#independent-expectations Nullable-string dereference becomes invalid under strict null checking; the disabled config plus authored source make the forwarded flag the independent cause.
 * @evidence contracts/testing.md#distinguishing-cases The negative flag-enabled scenario is checked. There is no same-fixture no-flag success invocation, and nonzero exit alone is narrowed only by the matching diagnostic.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_forwards_an_unknown_flag_to_tsgo entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary The launcher must hand its unknown flag through to the actual native check before runtime starts. Direct argv parser units cannot prove the selected compiler observed strictness.
 * @evidence contracts/e2e.md#shared-execution One tiny project and one launcher lifetime suffice; no dependency install or plugin producer occurs. The positive unchanged-config run is not repeated in this entry.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture is immutable, spawn captures the completed child streams and TestProject owns its directories. No invalidation/cache-hit distinction is asserted.
 * @evidence contracts/e2e.md#preserved-coverage Original nonzero status and null diagnostic remain unchanged. Successful non-strict execution and exact no-program-side-effects are not assertions of this case.
 */
export function test_ttsx_forwards_an_unknown_flag_to_tsgo() {
  const root = TestProject.commonJsProject(
    FixtureFiles.read("ttsc/ttsx_forwards_an_unknown_flag_to_tsgo/inputs-1"),
    { compilerOptions: { strict: false } },
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "--strict", "src/main.ts"],
    { cwd: root },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is possibly .?null/i);
}
