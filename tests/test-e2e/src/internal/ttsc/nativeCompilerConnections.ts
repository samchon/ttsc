import { GoBoundary } from "../GoBoundary";

/**
 * Retain the legacy mixed Go selection until its actual survivors are verified.
 *
 * Six CLI/server transport profiles, fourteen direct operation Tests and one
 * direct rewrite batch with a Node value oracle remain in this selection.
 * One additional native resident code-2/direct publication fallback keeps its
 * package-owned build and protocol assertions in the same Go selection.
 * The union is explicit so a renamed or removed case
 * cannot silently disappear from execution.
 *
 * @evidence contracts/common.md#principled-implementation The exact 22-name union preserves the existing six CLI/server profiles, thirteen NativePluginSource and one default LSP runner direct Tests, and nine-value RewriteRuntimeBatch. GoBoundary requires run/terminal/status observations; skip terminals are not coverage. Direct dependencies and an independent Node oracle do not make their owning operations E2E.
 * @evidence contracts/common.md#clear-and-simple-design A single selection call delegates compilation, assertions and fixture cleanup to the packages that own them.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No source outcome is synthesized or suppressed. The invocation uses count=1 and a missing selected name fails.
 * @evidence contracts/common.md#meaningful-documentation States each population's size and the division between selection and test ownership.
 * @evidence contracts/portability.md#os-neutral-implementation Module-relative Go package paths use Go's portable slash spelling, while GoBoundary resolves the physical module directory and toolchain through its shared owner.
 * @evidence contracts/performance.md#efficient-algorithms One exact-name selection visits the finite population once; runtime belongs to the actual native operations, not an additional preparation loop.
 * @evidence contracts/performance.md#reuse-equivalent-work One Go invocation selects five packages, including the package-owned resident fallback sidecar; actual package-owned preparations and original two rewrite Program groups remain. Two distinct generations are not stage reuse. Shared native producer/cache validity and process/population reduction require actual prepared identity and trace evidence; this registry neither creates producers nor measures those totals. Direct-unit duplicate selection remains until actual survival and removal gates.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This registry retains only its finite package/name arrays for the call. GoBoundary owns synchronous command observation; each selected Go Test owns its mapped producer/fixture/join and failure retention. Returned package command results and skip terminals are not arbitrary descendant completion or coverage certification. No existing cleanup is changed here.
 */
export function nativeCompilerConnections(): void {
  GoBoundary.run("ttsc", ["./test/cli","./test/platform","./test/ttscserver","./test/driver","./internal/lspserver"], [
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
  "TestDriverRewriteRuntimeBatch",
  "TestLSPProjectDiagnosticsResidentUnsupportedFallsBack"
]);
}
