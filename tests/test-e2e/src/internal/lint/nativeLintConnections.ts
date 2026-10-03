import { TestProject } from "@ttsc/testing";
import { createRequire } from "node:module";
import path from "node:path";
import { GoBoundary } from "../GoBoundary";

/**
 * Select the current mixed lint connection/direct-unit population in one Go batch.
 *
 * The built workspace ttsx launcher and pinned Prettier module are explicit
 * child inputs, so the temporary Go projects need no launcher on PATH or local
 * formatter installation. GoBoundary checks every exact case's terminal event.
 *
 * @evidence contracts/common.md#principled-implementation The sixteen explicit names identify actual package-owned Test entries. GoBoundary selects the e2e tag and requires each entry's run and terminal events before accepting the command result.
 * @evidence contracts/common.md#clear-and-simple-design One registry supplies the owning Go package and its two external artifacts; process execution and event validation remain with GoBoundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No result, executable or formatter is substituted. Missing tools, absent run/terminal events and nonzero command results propagate; a Go capability skip is printed as a terminal event without claiming assertion coverage.
 * @evidence contracts/common.md#meaningful-documentation Explains the shared batch, explicit evaluator and oracle inputs, and exact case completion checks.
 * @evidence contracts/portability.md#os-neutral-implementation Node resolves the pinned module from the workspace and joins the built launcher path. Go receives those absolute paths as environment data and executes JavaScript launchers through Node.
 * @evidence contracts/performance.md#efficient-algorithms The fixed registry is visited once; compilation and case execution are performed by one Go command, and its JSON output is processed once by GoBoundary.
 * @evidence contracts/performance.md#reuse-equivalent-work One linthost Go command selects sixteen names, including the now-untagged direct formatter unit. It does not collapse their separate Programs, evaluators, independent Node oracles or sidecar process requests; original cold/cache transitions and actual lifetimes need their own observations. Direct-unit duplicate selection is retained until actual survival proves safe removal.
 * @evidence contracts/performance.md#bound-retention-and-release-resources GoBoundary returns after its synchronous Go command result; package bodies own temporary inputs and their original joins. This registry does not independently certify every descendant or deferred cleanup. Buffered command output has the existing 64 MiB limit, and forced termination is not resource-release proof.
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
