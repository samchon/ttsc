import { TestProject } from "@ttsc/testing";
import { createRequire } from "node:module";
import path from "node:path";
import { GoBoundary } from "../GoBoundary";

/**
 * Execute the package-owned evaluator, formatter and LSP connections in one Go batch.
 *
 * The built workspace ttsx launcher and pinned Prettier module are explicit
 * child inputs, so the temporary Go projects need no launcher on PATH or local
 * formatter installation. GoBoundary checks every exact case's terminal event.
 *
 * @evidence contracts/common.md#principled-implementation The sixteen explicit names identify actual package-owned Test entries. GoBoundary selects the e2e tag and requires each entry's run and terminal events before accepting the command result.
 * @evidence contracts/common.md#clear-and-simple-design One registry supplies the owning Go package and its two external artifacts; process execution and event validation remain with GoBoundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No test result, executable or formatter is substituted. Missing tools and failed cases propagate rather than becoming skips or empty success.
 * @evidence contracts/common.md#meaningful-documentation Explains the shared batch, explicit evaluator and oracle inputs, and exact case completion checks.
 * @evidence contracts/portability.md#os-neutral-implementation Node resolves the pinned module from the workspace and joins the built launcher path. Go receives those absolute paths as environment data and executes JavaScript launchers through Node.
 * @evidence contracts/performance.md#efficient-algorithms The fixed registry is visited once; compilation and case execution are performed by one Go command, and its JSON output is processed once by GoBoundary.
 * @evidence contracts/performance.md#reuse-equivalent-work All sixteen entries share one Go test binary and process. Typed cases use the same built launcher and Prettier corpus rows share one imported formatter; cases retain distinct project identities and intentional cache transitions.
 * @evidence contracts/performance.md#bound-retention-and-release-resources GoBoundary synchronously joins the Go child before returning. Package tests own their temporary inputs and evaluator children; buffered output is bounded by the spawn helper's 64 MiB limit. Forced external termination does not establish deferred fixture cleanup.
 */
export function nativeLintConnections(): void {
  const requireWorkspace = createRequire(path.join(TestProject.WORKSPACE_ROOT, "package.json"));
  GoBoundary.run("lint", "./linthost", [
    "TestAwaitThenableSuggestionPreservesMicrotaskBoundary",
    "TestCommandCheckLoadsNoRestrictedTypesOptionsFromTypeScriptConfig",
    "TestConfigCacheInvalidatesTransitiveDependencyDigests",
    "TestConfigDependencyGraphNeverPublishesTheFilesystemRoot",
    "TestFormatPrettierConformance",
    "TestFormatSortImportsPreservesBindingImportEvaluationOrder",
    "TestLoadRuleConfigJavaScriptConfigFileRoundTripsFormatBlock",
    "TestLoadRuleConfigLoadsJavaScriptConfigFile",
    "TestLoadRuleConfigLoadsTypeScriptConfigFile",
    "TestLoadRuleConfigTypeScriptConfigFileRoundTripsFormatBlock",
    "TestLoadRuleConfigTypeScriptConfigMergesSpreadDefaultWrapper",
    "TestLoadRuleConfigTypeScriptFactoryMergesReturnedDefaultWrapper",
    "TestLSPFormatBufferRealBinaryE2E",
    "TestResidentRulesReuseExecutableConfigAcrossRealAndLinkedDependencies",
    "TestResidentRuleCacheRespectsConfigCacheOptOut",
    "TestScriptConfigLoaderTracksLocalDependencyGraph"
  ], {
    TTSC_TTSX_BINARY: TestProject.TTSX_BIN,
    TTSC_PRETTIER_MODULE: requireWorkspace.resolve("prettier"),
  });
}
