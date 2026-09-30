import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { STANDARD_DECORATOR_SOURCE } from "../../internal/ttsx-decorators";

/**
 * Verifies decorator lowering preserves diagnostics before execution.
 *
 * Runtime target selection must not hide invalid decorator signatures or add
 * libraries to a project that explicitly disables them.
 *
 * 1. Run an invalid decorator and decorated programs with lib [] or noLib.
 * 2. Exercise both config and CLI noLib settings plus an invalid target.
 * 3. Assert compiler diagnostics and no decorator or entry side effects.
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx rejects decorator signature, missing-library and invalid-target inputs before authored effects; each failure must contain its diagnostic code and omit effect markers.
 * @evidence contracts/testing.md#independent-expectations TypeScript diagnostics specify TS1329, TS2318 and TS6046; authored effect markers must not occur independently of runtime computation.
 * @evidence contracts/testing.md#distinguishing-cases Invalid decorator, lib [], config noLib, CLI noLib and invalid target distinguish five compile gates. Valid effects have library/host owners.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns five real rejecting compile/startup requests.
 * @evidence contracts/e2e.md#necessary-boundary Runtime option adjustment must retain the gate before Node side effects. Direct diagnostic or argument calls cannot establish launcher abort ordering.
 * @evidence contracts/e2e.md#shared-execution Each failing effective program requires its own native diagnostic/startup request because it intentionally cannot execute other consumers; toolchain artifacts are reused.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Immutable isolated tracked roots prevent diagnostic state leakage; processes complete before cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All five nonzero statuses, code distinctions and forbidden-effect assertions remain. Every rejecting program executes before collected assertion failures are thrown.
 */
export function test_ttsx_standard_decorators_reject_invalid_programs_before_effects() {
  const failures: unknown[] = [];
    const cases = [
      {
        options: {},
        args: [],
        source:
          'function invalid() { return 42; }\n@invalid\nclass Foo {}\nconsole.log("executed");',
        diagnostic: /TS1329/,
      },
      {
        options: { lib: [] },
        args: [],
        source: STANDARD_DECORATOR_SOURCE,
        diagnostic: /TS2318/,
      },
      {
        options: { noLib: true },
        args: [],
        source: STANDARD_DECORATOR_SOURCE,
        diagnostic: /TS2318/,
      },
      {
        options: {},
        args: ["--noLib"],
        source: STANDARD_DECORATOR_SOURCE,
        diagnostic: /TS2318/,
      },
      {
        options: {},
        args: ["--target", "invalid"],
        source: STANDARD_DECORATOR_SOURCE,
        diagnostic: /TS6046/,
      },
    ];
    for (const scenario of cases) {
      const root = TestProject.commonJsProject(
        { "src/main.ts": scenario.source },
        { compilerOptions: { target: "ESNext", ...scenario.options } },
      );
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        [...scenario.args, "src/main.ts"],
        { cwd: root },
      );
      try { assert.notEqual(result.status, 0); } catch (error) { failures.push(error); }
      try { assert.match(result.stderr + result.stdout, scenario.diagnostic); } catch (error) { failures.push(error); }
      try { assert.doesNotMatch(result.stdout, /Hello Class|Hello Function|executed/); } catch (error) { failures.push(error); }
    }

  if (failures.length) throw new AggregateError(failures, "standard_decorators_reject_invalid_programs_before_effects assertions failed");
}
