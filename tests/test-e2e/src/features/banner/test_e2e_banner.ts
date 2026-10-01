import { GoBoundary } from "../../internal/GoBoundary";
import { Scenarios } from "../../internal/Scenarios";
import { UtilityWorkspace } from "../../internal/UtilityWorkspace";
import { case_banner_diagnostic_lines_point_at_original_source } from "./scenes/case_banner_diagnostic_lines_point_at_original_source";
import { case_banner_preserves_executable_shebang } from "./scenes/case_banner_preserves_executable_shebang";
import { case_banner_rejects_missing_config_and_inline_options } from "./scenes/case_banner_rejects_missing_config_and_inline_options";
import { case_banner_selects_configuration_by_source } from "./scenes/case_banner_selects_configuration_by_source";
import { case_banner_shared_host_ignores_future_optional_flags } from "./scenes/case_banner_shared_host_ignores_future_optional_flags";
import { case_banner_source_maps_point_at_original_source } from "./scenes/case_banner_source_maps_point_at_original_source";
import { case_banner_ttsx_discovers_an_installed_package_root_config } from "./scenes/case_banner_ttsx_discovers_an_installed_package_root_config";

/**
 * Verifies the @ttsc/banner plugin through one shared workspace.
 *
 * The experiment copies `fixtures/banner/workspace` once, links the real package
 * once and reuses the content-keyed plugin cache. The scenarios share one
 * baseline source and one four-line banner configuration; each project differs
 * only by configuration source, manifest, compiler option or source shape.
 * Scenarios are independent and failures are reported under their names.
 *
 * 1. Open the workspace and run the selection, rejection, shebang, source-map,
 *    diagnostic, native-host and ttsx scenarios against it.
 * 2. Collect every scenario failure instead of stopping at the first.
 * 3. Remove the workspace and verify the linked package was not reached.
 *
 * @evidence contracts/testing.md#behavioral-verification Each scenario runs the built launcher, native plugin or ttsx over the shared workspace and asserts emitted banners, maps, diagnostics, process status or runtime output; this entry adds only the cleanup check.
 * @evidence contracts/testing.md#independent-expectations Expectations come from authored configuration texts, the documented preamble shape, source line counts and the source map format, stated in each scenario.
 * @evidence contracts/testing.md#distinguishing-cases Configuration sources, rejection inputs, shebang, three map modes, diagnostics, unknown flags and installed-package runtime are distinct outcomes, each with its own negative control.
 * @evidence contracts/testing.md#execution-ownership Exact named package-owned Go connections additionally execute through GoBoundary with the e2e tag; missing execution fails and capability skips establish no coverage. test_e2e_banner is the discoverable entry of the single test-e2e module; the seven scenarios are exported case functions selected by the same Evidence claim, and the Go units cover banner configuration discovery and value branches but not the preamble line shift, which these scenarios alone execute.
 * @evidence contracts/e2e.md#necessary-boundary Configuration loading, banner insertion with map correction, diagnostic rendering, native host protocol and ttsx runtime are real connections that unit calls do not exercise; each scenario states its contribution.
 * @evidence contracts/e2e.md#shared-execution The selected Go connection cases share one actual count=1 Go test process. Twelve former projects, package links and environments become one workspace copy and link; the baseline source and banner configuration are shared by seven projects. The shebang and ordinary sources share the external-map compiler Program and emit; launcher runs now require nine emits, one in-process plugin load with its native transform and one ttsx run, because each runs a distinct configuration, manifest or compiler-option state that the launcher reads per invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Project directories own their manifests and outputs; the workspace root has no manifest or banner configuration so discovery cannot leak between projects; the shared plugin cache is content keyed, and close removes the copy and verifies the link target survived.
 * @evidence contracts/e2e.md#preserved-coverage Every former assertion is retained in a scenario; the shared configuration changes the banner text of several scenarios to the four-line text without removing the checks.
 */
export async function test_e2e_banner(): Promise<void> {
  const workspace = UtilityWorkspace.open("banner");
  try {
    await Scenarios.collect("banner", [
      ["banner_native_driver_and_config_connections", () => GoBoundary.run("banner", "./test/e2e", [
        "TestCommandPrintsVersion",
        "TestCommandRejectsFlagShapedCommand",
        "TestCommandRejectsInvalidPluginManifest",
        "TestCommandRejectsUnknown",
        "TestCommandRequiresArgument",
        "TestCommandRunsBuild",
        "TestCommandRunsCheck",
        "TestCommandRunsTransform",
        "TestConfigLoaderTempBaseStaysOnConfigVolume",
        "TestJSONAndScriptConfigPathsNeverSpawnTheLauncher",
        "TestPhysicalHostInputResolvesWindowsJunction",
        "TestResolveBannerTextBranches",
        "TestResolveConfigTsgoResolvesThroughALinkedTypeScriptInstall",
        "TestScriptConfigLoaderPrefersDefaultExportOverNamedText",
        "TestScriptConfigLoaderPrefersTextOverDefault",
        "TestScriptConfigLoader",
        "TestScriptConfigLoaderUnwrapsNestedDefault",
        "TestTypeScriptConfigEvaluatesWithoutTheToolEnvironment",
        "TestTypeScriptConfigLoaderPrecedence",
        "TestTypeScriptConfigLoader",
        "TestWindowsJunctionTreatsPathsAsData",
      ])],
      ["selects_configuration_by_source", () => case_banner_selects_configuration_by_source(workspace)],
      ["rejects_missing_config_and_inline_options", () => case_banner_rejects_missing_config_and_inline_options(workspace)],
      ["preserves_executable_shebang", () => case_banner_preserves_executable_shebang(workspace)],
      ["source_maps_point_at_original_source", () => case_banner_source_maps_point_at_original_source(workspace)],
      ["diagnostic_lines_point_at_original_source", () => case_banner_diagnostic_lines_point_at_original_source(workspace)],
      ["shared_host_ignores_future_optional_flags", () => case_banner_shared_host_ignores_future_optional_flags(workspace)],
      ["ttsx_discovers_an_installed_package_root_config", () => case_banner_ttsx_discovers_an_installed_package_root_config(workspace)],
    ]);
  } finally {
    UtilityWorkspace.close(workspace);
  }
}
