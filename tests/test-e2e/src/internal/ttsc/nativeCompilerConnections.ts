import { GoBoundary } from "../GoBoundary";

/**
 * Select the package-owned actual CLI, server, child-protocol and runtime boundaries together.
 *
 * Each owning Go package shares its native artifacts and collects independent
 * case failures; the runtime batch emits each immutable option group once. The union is explicit so a renamed or removed case
 * cannot silently disappear from execution.
 *
 * @evidence contracts/common.md#principled-implementation Exact names identify the two CLI transport cases, one platform process, three server and fourteen child protocol assertions and one shared runtime batch; GoBoundary verifies their actual run and terminal events.
 * @evidence contracts/common.md#clear-and-simple-design A single selection call delegates compilation, assertions and fixture cleanup to the packages that own them.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No source outcome is synthesized or suppressed. The invocation uses count=1 and a missing selected name fails.
 * @evidence contracts/common.md#meaningful-documentation States each population's size and the division between selection and test ownership.
 * @evidence contracts/portability.md#os-neutral-implementation Module-relative Go package paths use Go's portable slash spelling, while GoBoundary resolves the physical module directory and toolchain through its shared owner.
 * @evidence contracts/performance.md#efficient-algorithms One exact-name selection visits the finite population once; runtime belongs to the actual native operations, not an additional preparation loop.
 * @evidence contracts/performance.md#reuse-equivalent-work One go test invocation uses the shared Go object cache and each package's once-built native producer; the runtime batch uses two effective compiler option groups and one Node consumer. The original raw false option remains independently asserted in its direct unit. Distinct compiler, platform command, language server and protocol fixtures keep their actual artifact identities.
 * @evidence contracts/performance.md#bound-retention-and-release-resources GoBoundary joins the command before return and bounds collected process bytes through the shared spawn limit. On normal completion, the package helpers establish native-child completion before removing their owned fixtures. An unresolved source callback retains its fixture and shared producer, reports their paths and fails the invocation; exceptional release is not claimed.
 */
export function nativeCompilerConnections(): void {
  GoBoundary.run("ttsc", ["./test/cli","./test/platform","./test/ttscserver","./test/driver"], [
  "TestCLIProcessCurrentDirectoryBuildSucceeds",
  "TestCLIProcessUnknownCommandFails",
  "TestPlatformProcessExitTransport",
  "TestTtscserverProcessExitTransport",
  "TestTtscserverCommandHandlesStdioShutdown",
  "TestTtscserverCommandUsesProcessCwd",
  "TestLSPNativePluginSourceAcceptsNullCodeActionEdit",
  "TestLSPNativePluginSourceAcceptsStdoutAtLimit",
  "TestLSPNativePluginSourceDropsCommandlessCodeAction",
  "TestLSPNativePluginSourceDropsDirectCodeActionEdit",
  "TestLSPNativePluginSourceDropsUnownedCodeActionCommand",
  "TestLSPNativePluginSourceIgnoresDuplicateCommandID",
  "TestLSPNativePluginSourcePipesContentStdin",
  "TestLSPNativePluginSourceOmitsContentStdinWhenEmpty",
  "TestLSPNativePluginSourcePipesEmptyContentStdin",
  "TestLSPNativePluginSourceRejectsDocumentChangesWorkspaceEdit",
  "TestLSPNativePluginSourceRejectsOversizedStdout",
  "TestLSPNativePluginSourceRoutesSidecarProtocol",
  "TestLSPNativePluginSourceTruncatesFailureStderr",
  "TestLSPServerDefaultRunnerConstructsRealServer",
  "TestDriverRewriteRuntimeBatch"
]);
}
