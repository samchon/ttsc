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
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_strip with the shared workspace; it exercises the built launcher's package discovery and native plugin, while default list semantics belong to Go units.
 * @evidence contracts/e2e.md#necessary-boundary Package-manifest auto-plugin discovery, including the upward walk, crosses launcher, filesystem and native host; no unit call establishes that connection.
 * @evidence contracts/e2e.md#shared-execution Both scenarios reuse the one workspace copy, package link and plugin cache; the two manifest positions are the only differing inputs, so two emits remain.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each emit writes its own dist directory and each manifest bounds its own discovery, so neither output or configuration is visible to the other or to sibling scenarios.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former default-config and ancestor-walk assertions (log, debug, assert.equal, debugger, kept) and extends the ancestor emit with the same full default set.
 */
export function case_strip_package_auto_plugin_uses_default_config(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  for (const scenario of ["package-default", "ancestor-package/packages/app"]) {
    const result = UtilityWorkspace.emit(workspace, scenario);
    assert.equal(result.status, 0, `${scenario}: ${result.stderr}`);
    const js = UtilityWorkspace.read(workspace, scenario, "dist/main.js");
    assert.match(js, /kept/, scenario);
    assert.doesNotMatch(
      js,
      /console\.(?:log|debug)|assert\.equal|\bdebugger\b|guarded-log-call/,
      scenario,
    );
  }
}
