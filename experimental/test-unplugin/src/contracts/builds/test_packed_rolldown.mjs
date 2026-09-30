
/**
 * Executes Rolldown production build and verifies ROLLDOWN-INSTALLED-OK in emitted code and Node stdout.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Executes Rolldown production build and verifies ROLLDOWN-INSTALLED-OK in emitted code and Node stdout.
 * @evidence contracts/testing.md#independent-expectations
 *   The fixture explicitly supplies ROLLDOWN-INSTALLED-OK as its transformed value. The original mark() and lowercase installed-ok forms must disappear; exact Node stdout is independent of the adapter's implementation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The output must contain the uppercase fixture value, omit the original call and run with exact stdout.
 * @evidence contracts/testing.md#execution-ownership
 *   The rolldown build phase calls this named E2E entry. assertBuiltOutput owns emitted marker, unchanged-call rejection and actual Node stdout; packed live-host cases separately own edit and recovery connections.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Rolldown native integration and generated production bundle execution are actual installed connections.
 * @evidence contracts/e2e.md#shared-execution
 *   One Rolldown build shares the dependency store and producer, with a backend-owned output directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   This rolldown case writes only its designated dist-rolldown output in the fresh packed consumer. Its synchronous build finishes before Node executes that output; no other backend writes this directory.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyRolldownBuild body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_rolldown({ workspace, run, assertBuiltOutput }) {
    run("npx rolldown -c rolldown.config.mjs", workspace);
    assertBuiltOutput("dist-rolldown/rolldown-entry.js", "ROLLDOWN-INSTALLED-OK", "rolldown");
}
