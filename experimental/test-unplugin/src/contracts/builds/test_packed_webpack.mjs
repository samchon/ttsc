
/**
 * Executes webpack production build and runs the emitted WEBPACK-INSTALLED-OK bundle.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Executes webpack production build and runs the emitted WEBPACK-INSTALLED-OK bundle.
 * @evidence contracts/testing.md#independent-expectations
 *   The fixture explicitly supplies WEBPACK-INSTALLED-OK as its transformed value. The original mark() and lowercase installed-ok forms must disappear; exact Node stdout is independent of the adapter's implementation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The marker must be transformed, its original call absent and actual stdout exactly the expected value.
 * @evidence contracts/testing.md#execution-ownership
 *   The webpack build phase calls this named E2E entry. assertBuiltOutput owns emitted marker, unchanged-call rejection and actual Node stdout; packed live-host cases separately own edit and recovery connections.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Webpack production loader assembly and executable emitted output require the actual installed host.
 * @evidence contracts/e2e.md#shared-execution
 *   One webpack production build shares installation and source producer; its output does not mutate persistent watch fixtures.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   This webpack case writes only its designated dist-webpack output in the fresh packed consumer. Its synchronous build finishes before Node executes that output; no other backend writes this directory.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyWebpackBuild body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_webpack({ workspace, run, assertBuiltOutput }) {
    run("npx webpack --config webpack.config.cjs", workspace);
    assertBuiltOutput("dist-webpack/webpack-entry.js", "WEBPACK-INSTALLED-OK", "webpack");
}
