import { GoBoundary } from "../GoBoundary";

/**
 * Select the native Go transport population without repeating direct units.
 *
 * Six retained CLI/server transport Tests remain unfinished.
 * Windows additionally admits the package-owned launcher/Go directory
 * fingerprint parity case; other platforms explicitly leave it unselected.
 * The union is explicit so a renamed or removed case
 * cannot silently disappear from execution.
 *
 * @evidence contracts/common.md#principled-implementation The exact six-name union plus Windows parity retains the still-uncomposed native transport assertions. Sidecar action, route, bounded reply and resident code2 policies now belong to their production-used operation units and the actual shared editor connection. TestLSPServerDefaultRunnerConstructsRealServer and TestDriverRewriteRuntimeBatch remain in their untagged Go unit population with the same bodies and nine rewrite literals, and are not invoked again here.
 * @evidence contracts/common.md#clear-and-simple-design A single selection call delegates compilation, assertions and fixture cleanup to the packages that own them.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No source outcome is synthesized or suppressed. The invocation uses count=1 and a missing selected name fails.
 * @evidence contracts/common.md#meaningful-documentation States each population's size and the division between selection and test ownership.
 * @evidence contracts/portability.md#os-neutral-implementation Module-relative Go package paths use Go's portable slash spelling, while GoBoundary resolves the physical module directory and toolchain through its shared owner.
 * @evidence contracts/performance.md#efficient-algorithms One exact-name selection visits the finite population once; runtime belongs to the actual native operations, not an additional preparation loop.
 * @evidence contracts/performance.md#reuse-equivalent-work One Go invocation selects the three CLI/server packages and the internal package for platform-admitted parity. Direct default-runner and rewrite preparation runs only in the Go unit population, avoiding a second execution in this E2E selection.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This registry retains only its finite package/name arrays for the call. GoBoundary owns synchronous command observation; each selected Go Test owns its mapped producer/fixture/join and failure retention. Returned package command results and skip terminals are not arbitrary descendant completion or coverage certification. No existing cleanup is changed here.
 */
export function nativeCompilerConnections(): void {
  const windowsNames = process.platform === "win32"
    ? ["TestLauncherReloadDirectoryFingerprintMatchesGo"] : [];
  if (windowsNames.length === 0)
    console.log("Go boundary admission: TestLauncherReloadDirectoryFingerprintMatchesGo UNSELECTED (Windows-only source population)");
  GoBoundary.run("ttsc", ["./test/cli","./test/platform","./test/ttscserver","./internal/lspserver"], [
  "TestCLIProcessCurrentDirectoryBuildSucceeds",
  "TestCLIProcessUnknownCommandFails",
  "TestPlatformProcessExitTransport",
  "TestTtscserverProcessExitTransport",
  "TestTtscserverCommandHandlesStdioShutdown",
  "TestTtscserverCommandUsesProcessCwd",
  ...windowsNames
]);
}

/**
 * Selects the remaining native command and Windows parity owners.
 * Direct units are excluded from both E2E entry selections.
 *
 * @evidence contracts/common.md#principled-implementation Exact six CLI/server names and admitted Windows fingerprint parity select their remaining original owning Go assertions. Sidecar reply, discovery and resident fallback decisions now compose actual source-unit literals with the shared installed LSP command, diagnostic, error and fix connection. Those units do not certify the removed controlled sidecars or their OS pipe capacities. GoBoundary checks named run/terminal/status, not inferred coverage.
 * @evidence contracts/common.md#clear-and-simple-design One exact-name Go invocation selects the necessary boundary subset; direct operation and rewrite contributors stay in their unit population.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No source, status, protocol response, producer image or Test result is synthesized. A skipped terminal remains no coverage.
 * @evidence contracts/common.md#meaningful-documentation Names the boundary subset, remaining package preparation and retained legacy selection without claiming reduction.
 * @evidence contracts/portability.md#os-neutral-implementation Existing Windows build-tag parity is admitted only on Windows; non-Windows logs unselected and gains no assertion pass. Native Go path and tool resolution stay with GoBoundary.
 * @evidence contracts/performance.md#efficient-algorithms A finite exact-name list feeds one four-package invocation; selected body compilation, native builds and command lifetimes remain measured work.
 * @evidence contracts/performance.md#reuse-equivalent-work The sidecar dispatcher and its remaining route, buffer and fallback Tests have been removed by the package owner. TestNativeReplyPolicies retains exact portable decisions and the shared editor retains the real native transport. Six CLI/server Tests and Windows parity still require execution consolidation; their old invocation is not a <=9 certificate. Fixed SDK/source compilation and other suite producers keep their existing owners; distinct producer kinds and terminating requests remain necessary inputs. Source-level sync.Once does not certify measured build counts or cache reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This registry owns no process or file handle. GoBoundary and the original Go Tests retain their real output, native command join and cleanup ownership; return is not arbitrary descendant completion.
 */
export function nativeCompilerTransportConnections(): void {
  const windowsNames = process.platform === "win32"
    ? ["TestLauncherReloadDirectoryFingerprintMatchesGo"] : [];
  if (windowsNames.length === 0)
    console.log("Go boundary admission: TestLauncherReloadDirectoryFingerprintMatchesGo UNSELECTED (Windows-only source population)");
  GoBoundary.run("ttsc", ["./test/cli", "./test/platform", "./test/ttscserver", "./internal/lspserver"], [
    "TestCLIProcessCurrentDirectoryBuildSucceeds",
    "TestCLIProcessUnknownCommandFails",
    "TestPlatformProcessExitTransport",
    "TestTtscserverProcessExitTransport",
    "TestTtscserverCommandHandlesStdioShutdown",
    "TestTtscserverCommandUsesProcessCwd",
    ...windowsNames,
  ]);
}
