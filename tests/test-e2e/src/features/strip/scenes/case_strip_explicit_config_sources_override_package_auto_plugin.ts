import assert from "node:assert/strict";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/strip plugin: an explicit tsconfig entry takes precedence
 * over the package auto-plugin and selects its configuration file.
 *
 * The override scenario has both a package dependency and a tsconfig entry, so
 * the plugin would be listed twice if the host did not deduplicate; its
 * auto-discovered config strips only `console.warn`. The explicit-path scenario
 * points `configFile` at a nested JSON file with the same list. In both, calls
 * the default list would remove must survive.
 *
 * 1. Emit the override scenario and the explicit-path scenario.
 * 2. Assert `console.warn` is absent in each.
 * 3. Assert `console.log` and `console.debug`, which the default list would
 *    remove, are present in each.
 *
 * @evidence contracts/testing.md#behavioral-verification Real ttsc emits with a duplicated declaration and an explicit configFile must apply only the warn-only configuration, removing console.warn and keeping default-list calls.
 * @evidence contracts/testing.md#independent-expectations The authored warn-only JSON and baseline source define the expected survivors; surviving log and debug distinguish the explicit configuration from the default list without reading plugin output rules.
 * @evidence contracts/testing.md#distinguishing-cases Duplicate package and tsconfig declarations, and an explicit relative configFile, are the two selection paths; log and debug are negative controls for accidentally applying defaults.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_strip with the shared workspace; configuration selection runs through the built launcher and native plugin rather than direct descriptor calls.
 * @evidence contracts/e2e.md#necessary-boundary tsconfig plugin precedence and configFile path resolution connect the descriptor loader to native configuration and emitted output.
 * @evidence contracts/e2e.md#shared-execution Both scenarios reuse the one workspace copy, package link and plugin cache and differ only in configuration selection, so two emits remain.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each scenario has its own manifest, configuration and dist directory, so the configuration of the configured scenario is never in either discovery path.
 * @evidence contracts/e2e.md#preserved-coverage Retains both former assertions (warn removed, log kept) and adds the debug survivor in each emit.
 */
export function case_strip_explicit_config_sources_override_package_auto_plugin(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  for (const scenario of ["override", "explicit-config-file"]) {
    const result = UtilityWorkspace.emit(workspace, scenario);
    assert.equal(result.status, 0, `${scenario}: ${result.stderr}`);
    const js = UtilityWorkspace.read(workspace, scenario, "dist/main.js");
    assert.doesNotMatch(js, /console\.warn/, scenario);
    assert.match(js, /console\.log\("log-call"\)/, scenario);
    assert.match(js, /console\.debug\("debug-call"\)/, scenario);
  }
}
