import { TestProject } from "@ttsc/testing";

import { GoBoundary } from "../GoBoundary";

/**
 * Select eleven remaining native lint connection owners in one Go batch.
 *
 * The built workspace ttsx launcher is an explicit child input. The sixty-one
 * target-rule/Prettier comparisons remain in their unchanged untagged Go unit
 * owner and are not repeated by this native connection batch.
 *
 * @evidence contracts/common.md#principled-implementation Eleven explicit native Test names preserve their remaining connection assertions. Basic CJS and typed loader rules are observed through nativeLintConfigCorpus's same two CLI/evaluator results, with their exact raw values, success and dependency normalization; owning Go JSON normalization retains the CJS severity pair. The synchronous namespace wrapper now shares that typed evaluator and Program, preserving inherited no-debugger error versus the locally ignored functional source without another native owner. The structured TypeScript restriction command now shares nativeLintConfigCorpus's actual typed-error result with its exact original message/stdio/status assertions. The removed TestFormatPrettierConformance selection remains covered by the same untagged Go Test and all its original sixty-one inputs, target-rule assertions and independent Node oracle.
 * @evidence contracts/common.md#clear-and-simple-design One registry supplies the owning Go package and its built ttsx input; process execution and event validation remain with GoBoundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No result, executable or formatter is substituted. Missing tools, absent run/terminal events and nonzero command results propagate; a Go capability skip is printed as a terminal event without claiming assertion coverage.
 * @evidence contracts/common.md#meaningful-documentation Explains the shared batch, explicit evaluator and oracle inputs, and exact case completion checks.
 * @evidence contracts/portability.md#os-neutral-implementation The existing absolute built launcher is supplied as environment data and executed through Node; native tools remain under their Go owners.
 * @evidence contracts/performance.md#efficient-algorithms The fixed registry is visited once; compilation and case execution are performed by one Go command, and its JSON output is processed once by GoBoundary.
 * @evidence contracts/performance.md#reuse-equivalent-work One linthost Go command shares package compilation for eleven remaining native owners. Structured-option diagnostic assertions consume the existing typed-error CLI result rather than launching another config-loader case. The sixty-one direct formatter comparisons run once in their ordinary Go unit population; remaining native cold/cache and process boundaries stay distinct.
 * @evidence contracts/performance.md#bound-retention-and-release-resources GoBoundary returns after its synchronous Go command result; package bodies own temporary inputs and their original joins. This registry does not independently certify every descendant or deferred cleanup. Buffered command output has the existing 64 MiB limit, and forced termination is not resource-release proof.
 */
export function nativeLintConnections(): void {
  GoBoundary.run(
    "lint",
    "./linthost",
    [
      "TestAwaitThenableSuggestionPreservesMicrotaskBoundary",
      "TestConfigCacheInvalidatesTransitiveDependencyDigests",
      "TestConfigDependencyGraphNeverPublishesTheFilesystemRoot",
      "TestFormatSortImportsPreservesBindingImportEvaluationOrder",
      "TestLoadRuleConfigJavaScriptConfigFileRoundTripsFormatBlock",
      "TestLoadRuleConfigTypeScriptConfigFileRoundTripsFormatBlock",
      "TestLoadRuleConfigTypeScriptFactoryMergesReturnedDefaultWrapper",
      "TestLSPFormatBufferRealBinaryE2E",
      "TestResidentRulesReuseExecutableConfigAcrossRealAndLinkedDependencies",
      "TestResidentRuleCacheRespectsConfigCacheOptOut",
      "TestScriptConfigLoaderTracksLocalDependencyGraph",
    ],
    {
      TTSC_TTSX_BINARY: TestProject.TTSX_BIN,
    },
  );
}
