import { nativeCompilerConnections } from "../../internal/ttsc/nativeCompilerConnections";

/**
 * Verifies native command dispatch, server transport, plugin protocols and emitted runtime loading.
 *
 * The package-owned Go cases share their actual producers and report independent
 * failures. Exact case selection also rejects a missing or renamed connection.
 *
 * 1. Run the CLI, platform command, language server and plugin protocol packages.
 * 2. Collect each selected Go case's run and terminal events.
 * 3. Require all 21 selected cases to complete and the invocation to succeed.
 *
 * @evidence contracts/testing.md#behavioral-verification The selected Go bodies assert native successful cwd build and failed-command OS status/stream transfer, server streams, actual plugin protocol responses and nine emitted module runtime exports. Missing case events and a nonzero Go invocation fail this entry.
 * @evidence contracts/testing.md#independent-expectations Each Go body owns its literal status, diagnostic, JSON, stream or filesystem expectation; this entry independently requires the explicit selected names to produce run and terminal events rather than accepting an empty successful selection.
 * @evidence contracts/testing.md#distinguishing-cases The population includes two CLI transport cases, one platform process case, three server cases, fourteen child protocol cases and one nine-case runtime batch. The Go subtests retain zero/nonzero command transport, server EOF/cwd acceptance and protocol boundary limits; metadata aliases have direct unit owners.
 * @evidence contracts/testing.md#execution-ownership The recursive E2E runner discovers this exported entry at the existing ttsc feature address. GoBoundary selects only the named e2e-tagged package-owned cases; direct Go units remain in the default Go population.
 * @evidence contracts/e2e.md#necessary-boundary Native front doors, actual server byte streams, plugin subprocess protocols and actual Node module loading establish assembly and transport that direct operation calls cannot establish. Individual Go cases explain their distinct real connections and oracle limitations.
 * @evidence contracts/e2e.md#shared-execution One Go invocation selects four package binaries. Each native command or protocol artifact is linked once for its selected consumers; the child protocol helper links its authored fixture variants together. The runtime batch copies static inputs once, uses two effective compiler option groups and loads all nine outputs in one Node process. The helper-decoy direct unit independently preserves and asserts its original raw false option. Separate command lifetimes remain necessary for distinct terminating argv invocations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each package owns immutable producer identity and per-case mutable fixtures. Normal cleanup establishes native-child completion before reclaiming the fixture and producer; an unresolved source callback retains both inputs, reports their paths and fails instead of claiming release. This synchronous entry waits for all package results before returning and shares no mutable project between cases.
 * @evidence contracts/e2e.md#preserved-coverage The explicit selection retains every necessary native assertion. Ten platform/server operation cases move to TestPlatformCommandOperationFamilies and TestTtscserverCommandOperationFamilies in the default Go population; original aliases, literal statuses and output assertions remain named. One boundary entry per command retains main OS exit zero/nonzero while two server transport cases remain unchanged. Twenty-one compiler command operation cases move to TestCLICommandOperationFamilies in the default Go population; their original preparations, statuses, diagnostics, JSON and disk assertions remain named. Two CLI process cases retain actual main exit zero/nonzero and cwd/stream transport. Four removed CLI duplicates have their identical inputs and equal or stronger assertions in the syntactic-diagnostic, unused-parameter, help-alias and version-alias survivors; their acknowledgments identify that mapping. Five structural rewrite units retain their original compiler assertions while one shared runtime batch retains their nine Node cases and literal expected exports.
 */
export function test_native_compiler_connections(): void {
  nativeCompilerConnections();
}
