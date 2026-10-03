import fs from "node:fs";
import path from "node:path";

/**
 * Runs both Next production bundlers and checks transformed ts, tsx, mts and cts markers in emitted assets.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Runs both Next production bundlers and checks transformed ts, tsx, mts and cts markers in emitted assets.
 * @evidence contracts/testing.md#independent-expectations
 *   Authored uppercase ts/tsx/mts/cts markers and their lowercase source literals independently define transformed versus untouched output for each supported Next bundler.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Each extension marker must become its authored uppercase value and its lowercase input must be absent, separately for webpack and Turbopack.
 * @evidence contracts/testing.md#execution-ownership
 *   The next phase runs this named case and the real glob matcher serially. This case preserves separate bundler failures and per-extension assertion labels; source Next option units do not run production assembly.
 * @evidence contracts/e2e.md#necessary-boundary
 *   withTtsc claims both actual Next bundlers; one can succeed while leaving transformations unexecuted, so both production connections remain.
 * @evidence contracts/e2e.md#shared-execution
 *   The two bundler lifetimes reuse one install and producer. They run sequentially because they own the same config and output, which is cleared between modes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Webpack and Turbopack use the same next.config.mjs but never overlap: dist-next is removed before each build. Each child finishes before its assets are read, excluding stale output from the previous mode.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyNextBuild body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export async function test_packed_next({ workspace, runIndependent, run, assertBuiltTreeContains , assert }) {
    // Both of Next's bundlers, because `withTtsc` claims both. The webpack half
    // was the only one checked for a long time, and forcing `--webpack` here is
    // what let the Turbopack half ship doing nothing at all: the build succeeded
    // and the output was simply untransformed (samchon/ttsc#1310). The assertion
    // is the same for each, and it is the one that fails when the transform did
    // not run, since it requires the transformed marker and refuses the original.
    const failed = await runIndependent(["--webpack", "--turbopack"], (bundler) => {
        fs.rmSync(path.join(workspace, "dist-next"), {
            force: true,
            recursive: true,
        });
        run(`npx next build ${bundler}`, workspace);
        for (const [marker, original, extension] of [
            ["NEXT-INSTALLED-OK", "next-installed-ok", ".ts"],
            ["TURBOPACK-TSX-OK", "turbopack-tsx-ok", ".tsx"],
            ["TURBOPACK-MTS-OK", "turbopack-mts-ok", ".mts"],
            ["TURBOPACK-CTS-OK", "turbopack-cts-ok", ".cts"],
        ]) {
            assertBuiltTreeContains("dist-next", marker, `next ${bundler} (${extension})`, original);
        }
        return 0;
    });
    assert(failed.length === 0, `Failed Next bundlers: ${failed.join(", ")}`);
}
