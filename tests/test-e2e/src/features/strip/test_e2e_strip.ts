import { GoBoundary } from "../../internal/GoBoundary";
import { Scenarios } from "../../internal/Scenarios";
import { UtilityWorkspace } from "../../internal/UtilityWorkspace";
import { case_strip_configured_calls_and_statements } from "./scenes/case_strip_configured_calls_and_statements";
import { case_strip_explicit_config_sources_override_package_auto_plugin } from "./scenes/case_strip_explicit_config_sources_override_package_auto_plugin";
import { case_strip_package_auto_plugin_uses_default_config } from "./scenes/case_strip_package_auto_plugin_uses_default_config";
import { case_strip_rejects_inline_config_keys } from "./scenes/case_strip_rejects_inline_config_keys";

/**
 * Verifies the @ttsc/strip plugin through one shared workspace.
 *
 * The experiment copies `fixtures/strip/workspace` once, links the real package
 * once and reuses the content-keyed plugin cache for every scenario. All
 * scenarios compile the same baseline source and differ only by how the plugin
 * and its configuration are selected, so each owns a small directory of
 * tsconfig, manifest and configuration files. Scenarios are independent: each
 * reaches its own verdict and failures are reported under their names.
 *
 * 1. Open the workspace and run the configured, default-discovery,
 *    explicit-source and rejection scenarios against it.
 * 2. Collect every scenario failure instead of stopping at the first.
 * 3. Remove the workspace and verify the linked package was not reached.
 *
 * @evidence contracts/testing.md#behavioral-verification Each scenario runs the built ttsc launcher over the shared baseline and asserts emitted JavaScript, declarations, runtime output or the launcher failure; this entry adds only the cleanup check.
 * @evidence contracts/testing.md#independent-expectations Expectations come from the authored configuration files and baseline source, documented in each scenario; the experiment adds none.
 * @evidence contracts/testing.md#distinguishing-cases The scenarios cover configured, default (own and ancestor manifest), duplicate-with-override, explicit path and rejected inline configuration; unconfigured neighbors are retained as negative controls.
 * @evidence contracts/testing.md#execution-ownership Exact named package-owned Go connections additionally execute through GoBoundary with the e2e tag; missing execution fails and capability skips establish no coverage. test_e2e_strip is the discoverable entry of the single test-e2e module; its four scenarios are exported case functions selected by the same Evidence claim, and AST-level strip semantics remain Go units.
 * @evidence contracts/e2e.md#necessary-boundary Launcher plugin discovery, configuration loading and native emit are real connections that descriptor and AST units do not exercise; each scenario states its own contribution.
 * @evidence contracts/e2e.md#shared-execution The selected Go connection cases share one actual count=1 Go test process. Six former per-case projects, package links and environments collapse into one workspace copy and link with the same six launcher runs, because each runs a distinct configuration or discovery state (including the rejected load) and the launcher reads those per invocation; the default-discovery pair stays separate because manifest position is the asserted difference.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Scenario directories own their manifests and outputs; the workspace root has no manifest or configuration so discovery cannot cross scenarios; the shared plugin cache is content keyed, and close removes the copy and checks the link target survived.
 * @evidence contracts/e2e.md#preserved-coverage Every former assertion is retained in a scenario, with console.warn, console.debug and the guarded call added as controls; no former case is omitted.
 */
export async function test_e2e_strip(): Promise<void> {
  const workspace = UtilityWorkspace.open("strip");
  try {
    await Scenarios.collect("strip", [
      ["strip_native_driver_and_config_connections", () => GoBoundary.run("strip", "./test/e2e", [
        "TestCommandLoadsConfigFromFile",
        "TestCommandPrintsVersion",
        "TestCommandRejectsFlagShapedCommand",
        "TestCommandRejectsInlineConfigKeys",
        "TestCommandRejectsInvalidPluginManifest",
        "TestCommandRejectsUnknown",
        "TestCommandRequiresArgument",
        "TestCommandRunsBuild",
        "TestCommandRunsCheck",
        "TestCommandRunsTransform",
        "TestCommandStripsEmbeddedStatementForms",
        "TestConfigLoaderTempBaseStaysOnConfigVolume",
        "TestJSONAndScriptConfigPathsNeverSpawnTheLauncher",
        "TestPhysicalHostInputResolvesWindowsJunction",
        "TestResolveConfigTsgoResolvesThroughALinkedTypeScriptInstall",
        "TestTypeScriptConfigEvaluatesWithoutTheToolEnvironment",
        "TestWindowsJunctionTreatsPathsAsData",
      ])],
      ["configured_calls_and_statements", () => case_strip_configured_calls_and_statements(workspace)],
      ["package_auto_plugin_uses_default_config", () => case_strip_package_auto_plugin_uses_default_config(workspace)],
      ["explicit_config_sources_override_package_auto_plugin", () => case_strip_explicit_config_sources_override_package_auto_plugin(workspace)],
      ["rejects_inline_config_keys", () => case_strip_rejects_inline_config_keys(workspace)],
    ]);
  } finally {
    UtilityWorkspace.close(workspace);
  }
}
