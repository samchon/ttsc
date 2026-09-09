import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorator support retains lower targets and legacy semantics.
 *
 * The runtime override applies only to ESNext. Raising a configured lower
 * target changes emitted syntax, and experimentalDecorators selects another
 * API.
 *
 * 1. Run the standard example at default, ES2025, and ES2019 targets.
 * 2. Assert optional chaining follows the effective config or CLI target.
 * 3. Run a legacy class decorator with experimentalDecorators at ESNext.
 */
export const test_ttsx_standard_decorators_keep_lower_targets_and_legacy_semantics =
  () => {
    for (const [target, args, nativeOptionalChain] of [
      [undefined, [], true],
      ["ES2025", [], true],
      ["ES2019", [], false],
      ["ESNext", ["-t", "es2019"], false],
      ["ESNext", ["--target", "null"], true],
    ] as const) {
      const root = TestProject.commonJsProject(
        {
          "src/main.ts":
            STANDARD_DECORATOR_SOURCE +
            '\nfunction optional(value?: { answer: number }) { return value?.answer; }\nconsole.log(optional.toString().includes("?."));',
        },
        { compilerOptions: { target } },
      );
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        [...args, "src/main.ts"],
        { cwd: root },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        result.stdout.trim(),
        STANDARD_DECORATOR_OUTPUT + "\n" + nativeOptionalChain,
      );
    }
    const root = TestProject.commonJsProject(
      {
        "src/main.ts":
          "function legacy(target: Function) { console.log(target.name); }\n@legacy\nclass Foo {}\nnew Foo();",
      },
      { compilerOptions: { target: "ESNext", experimentalDecorators: true } },
    );
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "Foo");
  };
