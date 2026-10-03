import assert from "node:assert/strict";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/strip plugin: a dependency on the package enables it with
 * the default configuration, both beside the tsconfig and at an ancestor.
 *
 * Neither scenario's tsconfig names a plugin. One package manifest sits in the
 * project directory itself; the other sits two levels above the tsconfig, so
 * discovery must walk upward. Both emit the same baseline, and the default
 * strip list must remove the same call and statement forms in each.
 *
 * 1. Emit the baseline from the project whose manifest is in its own directory.
 * 2. Emit it from `packages/app` below a manifest-bearing ancestor.
 * 3. Assert log, debug, assert.equal, debugger and the guarded call are absent
 *    and the exported value survives in both outputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Real ttsc emits of the baseline through manifest-only discovery must remove the default call and statement set and keep the kept value, once from the project directory and once from an ancestor manifest.
 * @evidence contracts/testing.md#independent-expectations The default stripped forms are the documented @ttsc/strip defaults and the baseline source authors each form, so expected absence does not come from the plugin's output.
 * @evidence contracts/testing.md#distinguishing-cases Own-directory and ancestor manifests are the two discovery positions; the exported value is the retained control. Explicit configuration and tsconfig plugin entries are owned by other scenarios.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_utilities with the shared workspace; it exercises the built launcher's package discovery and checkout-linked native plugin. These emitted-output assertions do not certify a separate direct-unit population or packed installation.
 * @evidence contracts/e2e.md#necessary-boundary Package-manifest auto-plugin discovery, including the upward walk, crosses launcher, filesystem and native host; no unit call establishes that connection.
 * @evidence contracts/e2e.md#shared-execution Both manifest positions reuse the workspace copy, package link and cache directory, with a fresh emit invocation per row and independent failure collection. These calls do not count internal compiler starts, Program constructions or cache hits.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each row reads its own dist output; the authored root and sibling layout keeps sibling configurations off its ancestor path. Shared environment, cache and resolution outside the copied root are not independently excluded. The utility parent owns cleanup after scene collection; direct synchronous return is not arbitrary descendant shutdown.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former default-config and ancestor-walk assertions (log, debug, assert.equal, debugger, kept) and extends the ancestor emit with the same full default set.
 */
export function case_strip_package_auto_plugin_uses_default_config(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const failures: Error[] = [];
  for (const scenario of ["package-default", "ancestor-package/packages/app"]) {
    try {
      const result = UtilityWorkspace.emit(workspace, scenario);
      assert.equal(result.status, 0, `${scenario}: ${result.stderr}`);
      const js = UtilityWorkspace.read(workspace, scenario, "dist/strip-case.js");
      assert.match(js, /kept/, scenario);
      assert.doesNotMatch(
        js,
        /console\.(?:log|debug)|assert\.equal|\bdebugger\b|guarded-log-call/,
        scenario,
      );
    } catch (error) {
      failures.push(new Error(scenario, { cause: error }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Strip package discovery failures");
}
