
/**
 * Runs actual Bun production build, locates its sole emitted entry and executes BUN-INSTALLED-OK.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Runs actual Bun production build, locates its sole emitted entry and executes BUN-INSTALLED-OK.
 * @evidence contracts/testing.md#independent-expectations
 *   The fixture explicitly supplies BUN-INSTALLED-OK as its transformed value. The original mark() and lowercase installed-ok forms must disappear; exact Node stdout is independent of the adapter's implementation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The uppercase marker replaces the original call and actual emitted code prints exactly the fixture value.
 * @evidence contracts/testing.md#execution-ownership
 *   The bun build phase calls this named E2E entry. assertBuiltOutput owns emitted marker, unchanged-call rejection and actual Node stdout; packed live-host cases separately own edit and recovery connections.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Bun build registration and emitted entry execution require the actual installed adapter in Bun.
 * @evidence contracts/e2e.md#shared-execution
 *   One Bun build shares the install and producer. Its output is independent of Node bundlers and precedes creation of the runtime preload config.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   This bun case writes only its designated dist-bun output in the fresh packed consumer. Its synchronous build finishes before Node executes that output; no other backend writes this directory.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyBunBuild body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_bun_build({ workspace, run, assertBuiltOutput, findSingleBuiltFile }) {
    run("bun bun-build.mjs", workspace);
    const output = findSingleBuiltFile("dist-bun", "bun-entry");
    assertBuiltOutput(output, "BUN-INSTALLED-OK", "bun");
}
