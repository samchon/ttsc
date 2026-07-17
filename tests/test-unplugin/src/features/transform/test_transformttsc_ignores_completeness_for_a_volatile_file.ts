import { assertVolatileFileIgnoresItsCompletenessDeclaration } from "../../internal/transform-complete";

/**
 * Verifies transformTtsc keeps the baseline union for a file the same envelope
 * declares both `dependenciesComplete` and `volatile`.
 *
 * The two declarations of samchon/ttsc#720 and #716 contradict: one says the
 * file's inputs are exactly the reported files, the other says an input is not
 * a file at all. A consumer that honored the narrower claim would drop watch
 * registrations on the strength of a declaration the same envelope already
 * contradicted, so the conservative one wins.
 *
 * 1. Run fixture entries that report dependencies, stamp a graph, declare
 *    `src/main.ts` complete, and declare the same file volatile.
 * 2. Collect addWatchFile invocations.
 * 3. Assert the full union (reach, globals, configs, dependencies) arrives.
 */
export const test_transformttsc_ignores_completeness_for_a_volatile_file =
  async () => {
    await assertVolatileFileIgnoresItsCompletenessDeclaration();
  };
