import { nativeLintConnections } from "../../internal/lint/nativeLintConnections";

/**
 * Selects the package-owned lint evaluator, formatter and stdin observation
 * population.
 *
 * The current sixteen names include real evaluator/binary connections and
 * direct owning operations with independent Node oracles. One Go test command
 * preserves their event names; it does not classify every case as E2E or prove
 * the number of Programs and child processes those bodies prepare.
 *
 * 1. Supply the built ttsx launcher and pinned Prettier module to the Go batch.
 * 2. Execute all sixteen exact Test entries with the e2e build tag.
 * 3. Require every selected entry to complete and the Go command to succeed.
 *
 * @evidence contracts/testing.md#behavioral-verification nativeLintConnections requests sixteen exact Go Test names; GoBoundary requires each run and terminal event and command status0. Each mapped donor owns its literal assertions, but a capability skip is a terminal event without assertion coverage and this wrapper does not inspect those assertions independently.
 * @evidence contracts/testing.md#independent-expectations The individual Go cases retain their literal diagnostic, source, cache generation and module trace expectations and pinned Prettier oracle. This entry expects successful completion of those independently asserted cases.
 * @evidence contracts/testing.md#distinguishing-cases The registry preserves executable CJS and typed config routing, format serialization, dependency invalidation and recovery, disabled cache, dirty and clean buffers, microtask ordering and import evaluation order.
 * @evidence contracts/testing.md#execution-ownership The directory E2E runner invokes this named registry wrapper once with tags=e2e. The flag does not exclude untagged direct units: packages/lint/linthost/format_prettier_conformance_e2e_test.go::TestFormatPrettierConformance is now a normal Go unit, with same-process target-rule SUT and independent Node oracle. Current duplicate selection remains until actual direct survival proves removal safe.
 * @evidence contracts/e2e.md#necessary-boundary Executable-config evaluation and compiled sidecar stdin preserve actual component connections. Independent Node evaluation alone does not make formatter/rule owning operations E2E, and dirty/clean sidecar calls exercise proxy-shaped argv rather than an actual LSP proxy. Exact direct and boundary distinctions remain in the existing sixteen donor matrices.
 * @evidence contracts/e2e.md#shared-execution One Go command selects one linthost package test population. Donor preparation includes distinct evaluator sessions, Programs and sidecar request processes; sharing the command does not collapse those lifetimes or certify cost reduction. No per-assertion replacement or selector removal is made here.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Donor matrices record their config identities, cold/invalidated inputs, environment restoration, temporary ownership and original joins; this wrapper validates events rather than independently witnessing all cleanup. Synchronous Go completion is not an arbitrary descendant join, and forced termination cannot establish deferred cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All sixteen original requested names and their donor inputs/assertions remain. Exact run/terminal checks reject empty selection but skips do not prove coverage. Formatter direct-unit selection/body is established, runtime survival and duplicate-call removal remain unverified; actual consumer activation and the other mapped boundary survivals remain separate gates.
 */
export function test_native_lint_connections(): void {
  nativeLintConnections();
}
