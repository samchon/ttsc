import { nativeCompilerConnections } from "../../internal/ttsc/nativeCompilerConnections";

/**
 * Verifies native command dispatch, server transport, plugin protocols and emitted runtime loading.
 *
 * The package-owned Go cases share their actual producers and report independent
 * failures. Exact case selection also rejects a missing or renamed connection.
 *
 * 1. Run the CLI, platform command, language server and plugin protocol packages.
 *    Include resident code-2 rejection followed by the direct publication.
 *    Windows also admits launcher/Go directory fingerprint agreement; its
 *    non-Windows unselected admission is not a pass or assertion coverage.
 * 2. Collect each selected Go case's run and terminal events.
 * 3. Require all 22 common names and the Windows-only name when admitted to complete and the invocation to succeed.
 *
 * @evidence contracts/testing.md#behavioral-verification The legacy selection calls 22 exact Go names. Their existing six CLI/server transport, fourteen direct operation, one nine-value rewrite and one native resident/direct fallback matrices remain in their owning Go bodies. This wrapper asserts run/terminal events and status0, not every body assertion itself; a skip terminal is explicitly not coverage.
 * @evidence contracts/testing.md#independent-expectations The explicit name list independently detects missing selection. Existing Go owners keep their authored statuses/streams/protocol/value maps. The rewrite Node consumer is an independent emitted-value language oracle for direct Go operations, not a necessary product process connection.
 * @evidence contracts/testing.md#distinguishing-cases Six actual terminating CLI/server profiles, thirteen NativePluginSource operations plus one default LSP runner direct unit, and one rewrite batch with nine original values retain distinct ownership. Windows/POSIX and capability skip populations are reported rather than certified from selection alone.
 * @evidence contracts/testing.md#execution-ownership The named recursive E2E entry delegates to nativeCompilerConnections/GoBoundary. Current 22-name common selection (plus one Windows-only parity name) includes fourteen untagged direct Go units; the Go e2e build tag does not exclude them. RewriteRuntimeBatch and its companion helpers currently remain tagged; their planned unit-selection adjustment is not actual executed coverage.
 * @evidence contracts/e2e.md#necessary-boundary The six actual CLI/server front-door lifetimes retain OS transport. The fourteen direct source units and direct RewriteRuntimeBatch plus independent Node oracle do not acquire an E2E requirement merely by starting a dependency. Legacy duplicate selection remains until actual survivor coverage and removal conditions are satisfied.
 * @evidence contracts/e2e.md#shared-execution The five-package Go invocation selects the preserved legacy 21 names plus the native resident unsupported/direct fallback case. Existing package-owned preparations remain: authored sidecars and real upstream server for direct units, native command producers for six transport profiles, and two distinct Program preparations plus one Node oracle for nine rewrite values. No stage reuse, once-per-total native build count or measured reduction is inferred.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Package-owned literal/producer/reset/join matrices already mapped remain separate from this wrapper. GoBoundary observes returned command status and named events; selected run plus skip is not assertion coverage, and command return is not arbitrary descendant closure. This entry creates no shared mutable fixture or new producer and changes no original cleanup operation.
 * @evidence contracts/e2e.md#preserved-coverage Windows TestLauncherReloadDirectoryFingerprintMatchesGo keeps existing/missing directory inputs and actual launcher/Go protocol agreement/currentness assertions in its owning body; non-Windows is unselected without coverage. TestLSPProjectDiagnosticsResidentUnsupportedFallsBack owns literal publication URI, single code, resident/direct count1 each and actual package-owned sidecar build/protocol; named run/terminal selection is authored, not runtime coverage. The exact 21 names and their existing original input/oracle matrices remain selected. Fourteen direct owners stay at their existing Go Test addresses; packages/ttsc/test/driver/rewrite_runtime_batch_e2e_test.go::TestDriverRewriteRuntimeBatch and companion helpers preserve nine literal maps and independent Node oracle. Existing unit-selection/actual execution and six shared transport profile survival remain unverified. Historical CommandOperationFamilies names are not confirmed current Test addresses here; no unverified family claim substitutes for any original selected assertion. No donor or redundant call is removed.
 */
export function test_native_compiler_connections(): void {
  nativeCompilerConnections();
}
