import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { FixtureFiles } from "../../../../internal/FixtureFiles";

/**
 * Verifies all missing-import branches preserve native resolution errors.
 *
 * Independent dynamic-import modules reject through the actual hooks. The host
 * records every rejection before rethrowing a real Node error, retaining the
 * launcher failure boundary without stopping after the first scenario.
 *
 * 1. Compile three computed missing-specifier modules in one project.
 * 2. Load each through one runtime host, recording its actual error code.
 * 3. Assert all native errors, error diagnostics and nonzero launcher exit.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx/Node imports reject missing bare, extensionless-relative and extensioned-relative requests; exact native codes and failed launcher exit are asserted.
 * @evidence contracts/testing.md#independent-expectations Node's ERR_MODULE_NOT_FOUND contract applies when no package or relative candidate exists; fixtures deliberately create none and do not derive expected codes from hooks.
 * @evidence contracts/testing.md#distinguishing-cases Bare specifiers must not probe relative extensions, extensionless requests may probe but still reject absent files, and concrete extensions preserve the original failure; successful resolutions remain in the adjacent ESM batch.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns three labeled real module rejections and the public launcher's failed process; fixture imports are input modules rather than hidden test declarations.
 * @evidence contracts/e2e.md#necessary-boundary Actual Node resolution exceptions must survive the installed synchronous hook chain and reach the public launcher status/diagnostic boundary.
 * @evidence contracts/e2e.md#shared-execution Equivalent compiler options and immutable missing inputs share one project, emit and Node host; catches let all three independent rejected modules run before one real rejection is rethrown.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh project has disjoint missing-relative scopes and no installed missing package; each import executes once, rejected state is local to its module and launcher cleanup owns outputs.
 * @evidence contracts/e2e.md#preserved-coverage All three original native-error diagnostics and nonzero-exit expectations survive, with stronger exact per-case codes; the host rethrows an actual captured error only after collecting unrelated failures.
 */
export function test_ttsx_missing_import_branches_preserve_native_errors_in_one_host() {
  const root = TestProject.createProject(
    FixtureFiles.read(
      "ttsc/ttsx_missing_import_branches_preserve_native_errors_in_one_host/inputs-1",
    ),
  );
  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );
  assert.deepEqual(JSON.parse(result.stdout.trim()), [
    {
      name: "test_ttsx_preserves_module_not_found_for_a_missing_package_import",
      code: "ERR_MODULE_NOT_FOUND",
    },
    {
      name: "test_ttsx_preserves_module_not_found_for_a_missing_extensionless_relative_import",
      code: "ERR_MODULE_NOT_FOUND",
    },
    {
      name: "test_ttsx_preserves_module_not_found_for_a_missing_relative_import_with_extension",
      code: "ERR_MODULE_NOT_FOUND",
    },
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/);
}
