import { FixtureFiles } from "../../../internal/FixtureFiles";
import { createProject } from "../../../internal/ttsc/internal/toolchain";
import { WatchSession } from "../../../internal/ttsc/internal/watch";

/**
 * Verifies `ttsc --watch` ignores an output directory created by its first
 * emit.
 *
 * The output directory does not exist while the watch topology is resolved, so
 * this covers the creation event that used to turn an otherwise idle compiler
 * into a rebuild loop.
 *
 * 1. Materialize an emit project whose configured `build` directory is absent.
 * 2. Start the real watch launcher and wait for its initial emit.
 * 3. Require a quiet period after `build` is created by that emit.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs an emitting WatchSession whose build outDir starts absent; waits for initial native completion and asserts no additional build start or completion during quiet.
 * @evidence contracts/testing.md#independent-expectations Compiler-owned output creation must not schedule another compile. The fixture deliberately omits build and counter snapshots independently detect feedback; output existence is not separately asserted.
 * @evidence contracts/testing.md#distinguishing-cases Owns initially missing outDir creation; a sibling entry covers a preexisting output directory, and authored input changes have positive rebuild entries.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_ignores_an_outdir_created_by_initial_emit is discovered under src/features/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary Watch topology is established before native emit creates the directory, so real creation callbacks can produce a feedback loop that a static exclusion unit misses.
 * @evidence contracts/e2e.md#shared-execution One session shares initial program load, native emit and idle observation. Built compiler/launcher installation is shared; no plugin artifact is produced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh project has no preexisting configured output; finally closes the watcher with bounded escalation and TestProject removes its paths at exit.
 * @evidence contracts/e2e.md#preserved-coverage Initial completion and both-counter quiet checks remain intact. The build marker does not by itself certify build/main.js existence or content.
 */
export const test_ttsc_watch_ignores_an_outdir_created_by_initial_emit =
  async (): Promise<void> => {
    const root = createProject(FixtureFiles.read("ttsc/ttsc_watch_ignores_an_outdir_created_by_initial_emit/inputs-1"));
    const session = new WatchSession(root);
    try {
      await session.waitForBuilds(1);
      await session.waitForQuiet();
    } finally {
      await session.close();
    }
  };
