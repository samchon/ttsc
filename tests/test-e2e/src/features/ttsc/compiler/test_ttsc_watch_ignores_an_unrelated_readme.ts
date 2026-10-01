import { FixtureFiles } from "../../../internal/FixtureFiles";
import { createProject, fs, path } from "../../../internal/ttsc/internal/toolchain";
import { WatchSession } from "../../../internal/ttsc/internal/watch";

/**
 * Verifies `ttsc --watch` does not rebuild for an unrelated README edit.
 *
 * Directory events are used only to reconcile compiler membership. A file that
 * remains outside the resolved program must not turn a repository-level edit
 * into a compiler invocation.
 *
 * 1. Start a no-emit project whose program contains only `src`.
 * 2. Wait for the initial real watch build to settle.
 * 3. Edit the root README and require that the session stays quiet.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs a noEmit WatchSession including src, changes an existing root README after initial completion and asserts no additional build start/completion during quiet.
 * @evidence contracts/testing.md#independent-expectations The authored include excludes README from compiler membership, so its content edit must not invalidate the program. Counter snapshots independently specify the negative scheduling result.
 * @evidence contracts/testing.md#distinguishing-cases Owns an unrelated existing text-file edit; membership creation and relevant external inputs have separate positive entries. The silence measurement lasts 900ms.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_ignores_an_unrelated_readme is discovered under src/features/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary Actual directory notifications must reconcile membership without launching native compilation for unrelated content, beyond what a direct classifier can establish.
 * @evidence contracts/e2e.md#shared-execution One process retains its initial program and subscriptions across the README write. Existing native compiler/launcher are reused, without plugin compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The unique root and initial completion separate startup from the edit; finally closes WatchSession and TestProject removes fixture state at exit.
 * @evidence contracts/e2e.md#preserved-coverage The README mutation and quiet check for both starts/completions remain unchanged. It does not generalize to every ignored extension or infinite time.
 */
export const test_ttsc_watch_ignores_an_unrelated_readme =
  async (): Promise<void> => {
    const root = createProject(FixtureFiles.read("ttsc/ttsc_watch_ignores_an_unrelated_readme/inputs-1"));
    const session = new WatchSession(root);
    try {
      await session.waitForBuilds(1);
      fs.writeFileSync(path.join(root, "README.md"), "changed\n", "utf8");
      await session.waitForQuiet();
    } finally {
      await session.close();
    }
  };
