import { assertCompleteFileNarrowsToDeclaredAndUniversalInputs } from "../../internal/transform-complete";

/**
 * Verifies transformTtsc registers only the declared inputs and the universal
 * config chain for a file the envelope declares `dependenciesComplete`.
 *
 * Pins the narrowing half of samchon/ttsc#720. Union semantics can never
 * invalidate below language-semantic reachability, so a precise producer's
 * per-file consulted list only ever widens; the declaration is what drops
 * `reach(edges, F)` and `globals` for that file. `configs` must survive the
 * drop, since compiler options reach generated code through the host rather
 * than through any file a plugin can consult.
 *
 * 1. Run fixture entries that report dependencies, stamp a graph whose reach and
 *    globals exceed them, and declare `src/main.ts` complete.
 * 2. Collect addWatchFile invocations.
 * 3. Assert only the reported dependencies and the tsconfig chain arrive.
 */
export const test_transformttsc_narrows_watch_inputs_for_a_file_declared_complete =
  async () => {
    await assertCompleteFileNarrowsToDeclaredAndUniversalInputs();
  };
