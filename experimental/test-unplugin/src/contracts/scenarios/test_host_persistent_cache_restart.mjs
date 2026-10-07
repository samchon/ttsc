import { restartContract } from "../restarts.mjs";

/**
 * Verifies a host adopts a stored generation and invalidates it after an edit.
 *
 * A second compiler in the same process could reuse memory and falsely prove
 * persistence. Fresh processes use the same actual host store instead.
 *
 * 1. Compile FIRST and wait for the host's persistent store.
 * 2. Restart twice unchanged and require zero native compiles.
 * 3. In the second adopted session, change and restore config without touching
 *    loaded source modules; require both current values.
 * 4. Edit the input while stopped, restart, and require SECOND.
 * 5. For webpack, restart unchanged again and require SECOND without compiling.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   restartContract drives restartCycle in four actual host processes, plus
 *   webpack's unchanged adoption of the updated generation. Each
 *   session asserts the literal current value; both unchanged sessions require
 *   zero native compiles. The second also checks a config-only edit and repair.
 * @evidence contracts/testing.md#independent-expectations
 *   FIRST, CONFIGURED and SECOND are deliberate fixture input values. No edit
 *   requires no native compile under the supported persisted-generation contract;
 *   counts come from the producer's log, not a host cache-success message.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Includes cold creation, two unchanged adoptions, observation after adoption
 *   and offline invalidation. Webpack also owns zero-compile adoption after
 *   invalidation, retaining that distinct persisted-cache assertion.
 *   Cache-disabled unwritable fixtures intentionally
 *   omit the zero-compile bound only after the actual product warning declares
 *   persistent caching unavailable; the ordinary cache batch retains that bound.
 * @evidence contracts/testing.md#execution-ownership
 *   The packed worker and unwritable batch call this named E2E entry for their
 *   selected host. restartCycle owns each process and case label. The source
 *   function unit for offline record proofs does not run this process batch.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Actual webpack, Rspack, Farm and Next stores must restore registered modules
 *   into fresh processes. Units cannot prove those native stores persist, that
 *   an adopted session observes live edits, or that the real host invalidates it.
 * @evidence contracts/e2e.md#shared-execution
 *   Reuses one install, producer, project and persistent store across four
 *   lifetimes, five for webpack's updated-store adoption. New processes are
 *   required to exclude in-memory reuse; source,
 *   config, declaration and membership proof variants do not need extra starts
 *   because every host consumes the same project-record signal.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   A host-specific fixture prevents another host's mutable state contaminating
 *   the store. Unchanged adoptions wait for actual committed store state; cold
 *   creation remains uncached. restartCycle closes each session in finally and
 *   reports state, records and host output when its expectation fails.
 * @evidence contracts/e2e.md#preserved-coverage
 *   Both initial zero-compile assertions, cached-session config edit/restoration,
 *   offline input edit and webpack's post-edit zero-compile adoption remain real
 *   boundaries. The offline-record proof unit
 *   owns separate config/base/source/declaration/external/missing/membership and
 *   dependency-rename distinctions with restoration and excluded-output controls;
 *   the live host scenarios retain their compiler errors and watch registrations.
 */
export async function test_host_persistent_cache_restart({ project, host }) {
  await restartContract(project, host);
}
