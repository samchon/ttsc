import { TestProject } from "@ttsc/testing";
import { GoBoundary } from "../GoBoundary";

/**
 * Select fifteen native lint connection owners in one Go batch.
 *
 * The built workspace ttsx launcher is an explicit child input. The sixty-one
 * target-rule/Prettier comparisons remain in their unchanged untagged Go unit
 * owner and are not repeated by this native connection batch.
 *
 * @evidence contracts/common.md#principled-implementation Fifteen explicit native Test names preserve their connection assertions. The removed TestFormatPrettierConformance selection is covered by the same untagged Go Test and all its original sixty-one inputs, target-rule assertions and independent Node oracle.
 * @evidence contracts/common.md#clear-and-simple-design One registry supplies the owning Go package and its built ttsx input; process execution and event validation remain with GoBoundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No result, executable or formatter is substituted. Missing tools, absent run/terminal events and nonzero command results propagate; a Go capability skip is printed as a terminal event without claiming assertion coverage.
 * @evidence contracts/common.md#meaningful-documentation Explains the shared batch, explicit evaluator and oracle inputs, and exact case completion checks.
 * @evidence contracts/portability.md#os-neutral-implementation The existing absolute built launcher is supplied as environment data and executed through Node; native tools remain under their Go owners.
 * @evidence contracts/performance.md#efficient-algorithms The fixed registry is visited once; compilation and case execution are performed by one Go command, and its JSON output is processed once by GoBoundary.
 * @evidence contracts/performance.md#reuse-equivalent-work One linthost Go command shares package compilation for fifteen native owners. The sixty-one direct formatter comparisons run once in their ordinary Go unit population instead of preparing and evaluating them again here; native cold/cache and process boundaries remain separate assertions.
 * @evidence contracts/performance.md#bound-retention-and-release-resources GoBoundary returns after its synchronous Go command result; package bodies own temporary inputs and their original joins. This registry does not independently certify every descendant or deferred cleanup. Buffered command output has the existing 64 MiB limit, and forced termination is not resource-release proof.
 */
export function nativeLintConnections(): void {
  GoBoundary.run("lint", "./linthost", [
    "TestAwaitThenableSuggestionPreservesMicrotaskBoundary",
    "TestCommandCheckLoadsNoRestrictedTypesOptionsFromTypeScriptConfig",
    "TestConfigCacheInvalidatesTransitiveDependencyDigests",
    "TestConfigDependencyGraphNeverPublishesTheFilesystemRoot",
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
  });
}
