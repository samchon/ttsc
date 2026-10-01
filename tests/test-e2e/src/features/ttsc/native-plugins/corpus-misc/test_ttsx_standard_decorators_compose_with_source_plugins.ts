import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestUtilityPlugins } from "../../../../internal/ttsc/internal/TestUtilityPlugins";
import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../../../internal/ttsc/internal/ttsx-decorators";

/**
 * Verifies standard decorators execute alongside native source transforms.
 *
 * The native host receives compiler overrides through TTSC_TSGO_ARGS rather
 * than its command-line parser. Both transforms must reach the executed emit.
 *
 * 1. Configure the source-backed strip plugin at ESNext.
 * 2. Add a console.warn for the plugin to remove beside the decorator example.
 * 3. Assert class and method effects, with the warning removed.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsx executes the standard decorator class/method effects while strip removes the must-be-stripped warning.
 * @evidence contracts/testing.md#independent-expectations The decorator fixture carries a handwritten output constant and strip config explicitly selects console.warn.
 * @evidence contracts/testing.md#distinguishing-cases ESNext decorator lowering must compose with native strip; ordinary decorator-only cases own execution without a source plugin.
 * @evidence contracts/testing.md#execution-ownership The exported test_ttsx_standard_decorators_compose_with_source_plugins entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The ttsx compiler/runtime connection must compose standard decorator lowering with the real strip source host; direct strip or decorator unit calls cannot prove the executed emit contains both effects.
 * @evidence contracts/e2e.md#shared-execution The suite reuses built workspace packages and the shared content-addressed producer cache when this case selects it. Separate launcher invocations carry this case's differing arguments or selected runtime entry; a case-local cold cache is retained when preparation or failure is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsx executes the standard decorator class/method effects while strip removes the must-be-stripped warning. These assertions stay in test_ttsx_standard_decorators_compose_with_source_plugins with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_ttsx_standard_decorators_compose_with_source_plugins = () => {
  const root = TestProject.commonJsProject(
    {
      "strip.config.json": JSON.stringify({ calls: ["console.warn"] }),
      "src/main.ts":
        'console.warn("must-be-stripped");\n' + STANDARD_DECORATOR_SOURCE,
    },
    {
      compilerOptions: {
        target: "ESNext",
        plugins: [{ transform: "@ttsc/strip" }],
      },
    },
  );
  TestUtilityPlugins.seedPackages(root, ["strip"]);
  const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
    cwd: root,
    env: { PATH: TestUtilityPlugins.goPath() },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT);
  assert.doesNotMatch(result.stderr, /must-be-stripped/);
};
