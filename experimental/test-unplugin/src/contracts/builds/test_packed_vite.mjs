
/**
 * Executes Vite production build and verifies VITE-INSTALLED-OK in emitted code and actual Node stdout.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Executes Vite production build and verifies VITE-INSTALLED-OK in emitted code and actual Node stdout.
 * @evidence contracts/testing.md#independent-expectations
 *   The fixture explicitly supplies VITE-INSTALLED-OK as its transformed value. The original mark() and lowercase installed-ok forms must disappear; exact Node stdout is independent of the adapter's implementation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The transformed marker must replace mark() and the original lowercase marker; emitted execution must print exactly the literal value.
 * @evidence contracts/testing.md#execution-ownership
 *   The vite build phase calls this named E2E entry. assertBuiltOutput owns emitted marker, unchanged-call rejection and actual Node stdout; packed live-host cases separately own edit and recovery connections.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Vite production integration must consume the installed adapter and emit executable transformed source.
 * @evidence contracts/e2e.md#shared-execution
 *   One Vite production build uses the shared install and producer; its output directory remains independent of other backends.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   This vite case writes only its designated dist-vite output in the fresh packed consumer. Its synchronous build finishes before Node executes that output; no other backend writes this directory.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyViteBuild body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_vite({ workspace, run, assertBuiltOutput }) {
    run("npx vite build --config vite.config.mjs", workspace);
    assertBuiltOutput("dist-vite/vite-entry.js", "VITE-INSTALLED-OK", "vite");
}
