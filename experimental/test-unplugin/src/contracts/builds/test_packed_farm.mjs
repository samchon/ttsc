
/**
 * Executes Farm production build, selects its sole emitted entry and runs FARM-INSTALLED-OK through Node.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Executes Farm production build, selects its sole emitted entry and runs FARM-INSTALLED-OK through Node.
 * @evidence contracts/testing.md#independent-expectations
 *   The fixture explicitly supplies FARM-INSTALLED-OK as its transformed value. The original mark() and lowercase installed-ok forms must disappear; exact Node stdout is independent of the adapter's implementation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The actual entry must be unique, transformed and executable with exact fixture stdout; stale or duplicate entry emission fails.
 * @evidence contracts/testing.md#execution-ownership
 *   The farm build phase calls this named E2E entry. assertBuiltOutput owns emitted marker, unchanged-call rejection and actual Node stdout; packed live-host cases separately own edit and recovery connections.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Farm native production integration and emitted entry discovery cannot be certified by a mocked hook.
 * @evidence contracts/e2e.md#shared-execution
 *   One Farm build uses the shared install and producer; its own output directory isolates emitted entry discovery.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   This farm case writes only its designated dist-farm output in the fresh packed consumer. Its synchronous build finishes before Node executes that output; no other backend writes this directory.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyFarmBuild body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_farm({ workspace, run, assertBuiltOutput, findSingleBuiltFile }) {
    run("node farm-build.mjs", workspace);
    const output = findSingleBuiltFile("dist-farm", "farm-entry");
    assertBuiltOutput(output, "FARM-INSTALLED-OK", "farm");
}
