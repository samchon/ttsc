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
 * The ESNext configuration must reach the executed emit together with strip.
 * This case observes their composed effects, not every internal child argv.
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
 * @evidence contracts/e2e.md#shared-execution seedPackages junction-links the built workspace strip package into one consumer; this is not a packed installation. The suite compiler and Go toolchain are available for reuse, but this output does not count preparations, certify cache hits or prove minimum process cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject tracks the temporary consumer; strip config and decorator source belong to that consumer. The PATH override is child-specific. The synchronous command result checks launch error, signal and exit status before consuming output; it does not certify arbitrary descendants or loaded executable bytes. No independent shared-plugin-cache selection is asserted here.
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
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT);
  assert.doesNotMatch(result.stderr, /must-be-stripped/);
};
