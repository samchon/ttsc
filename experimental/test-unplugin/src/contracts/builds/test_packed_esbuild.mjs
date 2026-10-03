
/**
 * Executes esbuild production assembly, runs its transformed bundle and executes the optimized bare bun-register import.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Executes esbuild production assembly, runs its transformed bundle and executes the optimized bare bun-register import.
 * @evidence contracts/testing.md#independent-expectations
 *   The fixture explicitly supplies ESBUILD-INSTALLED-OK as its transformed value. The original mark() and lowercase installed-ok forms must disappear; exact Node stdout is independent of the adapter's implementation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   ESBUILD-INSTALLED-OK must replace the original call; BUN-REGISTER-OPTIMIZER-OK proves the side-effect registration survived optimization exactly once.
 * @evidence contracts/testing.md#execution-ownership
 *   The esbuild build phase calls this named E2E entry. assertBuiltOutput owns emitted marker, unchanged-call rejection and actual Node stdout; packed live-host cases separately own edit and recovery connections.
 * @evidence contracts/e2e.md#necessary-boundary
 *   The installed esbuild adapter and optimized side-effect package import must work after bundling, which callback units cannot establish.
 * @evidence contracts/e2e.md#shared-execution
 *   One esbuild invocation creates both output consumers; no separate installation or optimizer-only bundler process is added.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   This esbuild case writes only its designated dist-esbuild output in the fresh packed consumer. Its synchronous build finishes before Node executes that output; no other backend writes this directory.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyEsbuildBuild body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_esbuild({ workspace, run, assertBuiltOutput , assert }) {
    run("node esbuild.config.cjs", workspace);
    assertBuiltOutput("dist-esbuild/esbuild-entry.js", "ESBUILD-INSTALLED-OK", "esbuild");
    const { stdout } = run("node dist-esbuild/bun-register-optimizer-entry.js", workspace);
    assert(stdout.includes("BUN-REGISTER-OPTIMIZER-OK"), "esbuild must retain the packed bun-register bare import and execute it exactly once");
}
