
/**
 * Executes Rspack production build and runs the emitted RSPACK-INSTALLED-OK bundle.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Executes Rspack production build and runs the emitted RSPACK-INSTALLED-OK bundle.
 * @evidence contracts/testing.md#independent-expectations
 *   The fixture explicitly supplies RSPACK-INSTALLED-OK as its transformed value. The original mark() and lowercase installed-ok forms must disappear; exact Node stdout is independent of the adapter's implementation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Transformed uppercase value must replace the original marker and print exactly in actual Node execution.
 * @evidence contracts/testing.md#execution-ownership
 *   The rspack build phase calls this named E2E entry. assertBuiltOutput owns emitted marker, unchanged-call rejection and actual Node stdout; packed live-host cases separately own edit and recovery connections.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Rspack native production host registration and emitted output remain distinct from webpack and source hook units.
 * @evidence contracts/e2e.md#shared-execution
 *   One Rspack production build shares the same installed dependencies and producer with separate output.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   This rspack case writes only its designated dist-rspack output in the fresh packed consumer. Its synchronous build finishes before Node executes that output; no other backend writes this directory.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyRspackBuild body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_rspack({ workspace, run, assertBuiltOutput }) {
    run("npx rspack build --config rspack.config.cjs", workspace);
    assertBuiltOutput("dist-rspack/rspack-entry.js", "RSPACK-INSTALLED-OK", "rspack");
}
