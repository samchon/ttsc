import { predicateContract } from "../predicates.mjs";

/**
 * Verifies real host rebuilds respect the compiler predicate record.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   predicateContract uses actual host watch hooks and asserts runs 1, 2 and 3 for initial compile, missing type-directory creation and new included root declaration. Unrelated dependency output and tool-cache writes must leave both build and compile counts unchanged.
 * @evidence contracts/testing.md#independent-expectations
 *   The compiler consulted the missing type resolution and included root directory, but never consulted the two unrelated written files. Literal compile counts and quiet-build equality follow that dependency contract.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Includes two unrelated negative writes, creation of a previously missing @types directory, and creation of an included root declaration. Quiet windows distinguish no host rebuild from a rebuild that reused a compiler generation.
 * @evidence contracts/testing.md#execution-ownership
 *   The packed worker calls this named entry once for each watching backend, selecting its actual start implementation. predicateContract owns individual phase labels; source record-proof units own portable input-kind calculations.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Actual Rollup, Rolldown, webpack, Rspack, esbuild and Farm watch registrations must connect moved records to host rebuilding, and exclude irrelevant notifications. A predicate unit cannot verify a native host receives these signals.
 * @evidence contracts/e2e.md#shared-execution
 *   One existing predicate project and watch session serve all three positive states and both negative writes. Different host hooks require their own connection; no input-kind-specific process is launched.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Each host receives its own predicate fixture and compile counter. The actual first host build finishes and watcher activity settles before recording the negative build baseline; positive creations follow only after the negative observation window. The harness closes each session in finally with a deadline.
 * @evidence contracts/e2e.md#preserved-coverage
 *   All original build-count and producer-count assertions, quiet windows and diagnostic record snapshots remain in predicateContract. The wrapper adds an executable evidence address without adding preparation or replacing real notifications with unit claims.
 */
export async function test_host_watching_predicates(name, start) {
  await predicateContract(name, start);
}
