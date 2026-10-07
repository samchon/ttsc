
/**
 * Executes Rollup production build and verifies ROLLUP-INSTALLED-OK in emitted code and Node stdout.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Executes Rollup production build and verifies ROLLUP-INSTALLED-OK in emitted code and Node stdout.
 * @evidence contracts/testing.md#independent-expectations
 *   The fixture explicitly supplies ROLLUP-INSTALLED-OK as its transformed value. The original mark() and lowercase installed-ok forms must disappear; exact Node stdout is independent of the adapter's implementation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The transformed marker must replace mark() and original lowercase input; Node must print exactly the fixture value.
 * @evidence contracts/testing.md#execution-ownership
 *   The rollup build phase calls this named E2E entry. assertBuiltOutput owns emitted marker, unchanged-call rejection and actual Node stdout; packed live-host cases separately own edit and recovery connections.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Installed Rollup hook registration and production output assembly require the real bundler.
 * @evidence contracts/e2e.md#shared-execution
 *   One Rollup build uses the common installed artifacts and producer; its output is distinct from Vite and watch fixtures.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   This rollup case writes only its designated dist-rollup output in the fresh packed consumer. Its synchronous build finishes before Node executes that output; no other backend writes this directory.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyRollupBuild body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_rollup({ workspace, run, assertBuiltOutput }) {
    run("npx rollup -c rollup.config.mjs", workspace);
    assertBuiltOutput("dist-rollup/rollup-entry.js", "ROLLUP-INSTALLED-OK", "rollup");
}
