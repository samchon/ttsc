import { nativeLintConnections } from "../../internal/lint/nativeLintConnections";

/**
 * Verifies the package-owned lint evaluator, formatter and LSP connections.
 *
 * Executable configuration, independent JavaScript evaluation and binary stdin
 * must cross their actual process boundaries. The batch preserves each Go
 * case's failure identity instead of creating one process per assertion.
 *
 * 1. Supply the built ttsx launcher and pinned Prettier module to the Go batch.
 * 2. Execute all sixteen exact Test entries with the e2e build tag.
 * 3. Require every selected entry to complete and the Go command to succeed.
 *
 * @evidence contracts/testing.md#behavioral-verification nativeLintConnections executes the actual sixteen Go Test bodies. Their rule/config results, cache transitions, independent formatter and JavaScript traces, resident replies and binary stdin assertions remain checked; GoBoundary rejects missing or incomplete entries and nonzero command status.
 * @evidence contracts/testing.md#independent-expectations The individual Go cases retain their literal diagnostic, source, cache generation and module trace expectations and pinned Prettier oracle. This entry expects successful completion of those independently asserted cases.
 * @evidence contracts/testing.md#distinguishing-cases The registry preserves executable CJS and typed config routing, format serialization, dependency invalidation and recovery, disabled cache, dirty and clean buffers, microtask ordering and import evaluation order.
 * @evidence contracts/testing.md#execution-ownership The directory E2E runner discovers this exported entry under features/lint. It invokes nativeLintConnections once, which selects all sixteen package-owned Test names with the e2e tag; portable Go units exclude those files.
 * @evidence contracts/e2e.md#necessary-boundary Real Node/ttsx evaluation, the independent formatter, persistent request streams and the compiled lint sidecar's stdin protocol connect components that direct rule operations cannot verify.
 * @evidence contracts/e2e.md#shared-execution One Go test binary and process serve the sixteen entries. The formatter imports its oracle once for the corpus, and the compiled lint sidecar serves dirty and clean requests; intentional module origins and cache mutations retain their necessary evaluator sessions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Go cases own temporary directories, restore changed environment and project rules, and join their evaluator and request lifetimes. Distinct configuration identities prevent another case's cache answer from satisfying a cold or changed-input assertion. Forced external termination cannot guarantee deferred cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Each original Go case keeps its inputs, assertions and failure name. Exact Go run/terminal event checks prevent successful empty selections; the batch changes execution ownership without weakening expected behavior.
 */
export function test_native_lint_connections(): void {
  nativeLintConnections();
}
