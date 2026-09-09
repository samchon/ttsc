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
 */
export const test_ttsx_standard_decorators_reject_invalid_programs_before_effects =
  () => {
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
      assert.notEqual(result.status, 0);
      assert.match(result.stderr + result.stdout, scenario.diagnostic);
      assert.doesNotMatch(result.stdout, /Hello Class|Hello Function|executed/);
    }
  };
