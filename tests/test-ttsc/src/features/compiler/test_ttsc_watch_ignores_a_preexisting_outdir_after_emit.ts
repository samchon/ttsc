import { createProject } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies `ttsc --watch` ignores emits into a pre-existing output directory.
 *
 * The former directory walk watched arbitrary output names, so the initial
 * build wrote to `build` and immediately scheduled another build forever. The
 * resolved-program watch set must exclude compiler-owned output regardless of
 * whether that directory existed before watch startup.
 *
 * 1. Materialize an emit project with a pre-existing `build` directory.
 * 2. Start the real watch launcher and wait for its initial build.
 * 3. Require a quiet period with no self-triggered rebuild.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs WatchSession with build/.keep present and configured outDir build; waits for native completion then requires quiet with neither a new start nor completion.
 * @evidence contracts/testing.md#independent-expectations Configured output exclusion must hold regardless of initial directory existence. Authored .keep and outDir establish the initial state independently of topology resolution.
 * @evidence contracts/testing.md#distinguishing-cases Owns compiler writes into an existing output directory; the absent-outDir entry covers creation. Actual generated file existence/content is not asserted.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_ignores_a_preexisting_outdir_after_emit is discovered under src/features/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary A directory present at startup can already have callbacks when the compiler writes into it. Real native emit and watcher scheduling jointly detect that feedback.
 * @evidence contracts/e2e.md#shared-execution One host session batches initial emit and idle observation, sharing built compiler/launcher installation; no native plugin producer is required.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique source/build paths prevent shared output state. finally closes WatchSession with bounded kill fallback and TestProject removes the root at worker exit.
 * @evidence contracts/e2e.md#preserved-coverage Initial build and quiet-counter assertions remain. They pin absence of a self-triggered cycle during the observation window rather than JavaScript content.
 */
export const test_ttsc_watch_ignores_a_preexisting_outdir_after_emit =
  async (): Promise<void> => {
    const root = createProject({
      "build/.keep": "",
      "src/main.ts": `export const value = 1;\n`,
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "build",
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
    });
    const session = new WatchSession(root);
    try {
      await session.waitForBuilds(1);
      await session.waitForQuiet();
    } finally {
      await session.close();
    }
  };
