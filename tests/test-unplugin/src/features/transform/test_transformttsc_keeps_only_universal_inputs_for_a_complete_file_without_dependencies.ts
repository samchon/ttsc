import { assertCompleteFileWithoutDependenciesKeepsOnlyUniversalInputs } from "../../internal/transform-complete";

/**
 * Verifies transformTtsc registers only the config chain for a file declared
 * complete whose envelope reports no dependencies for it at all.
 *
 * The empty-list boundary of samchon/ttsc#720, and the case that carries the
 * largest win: a plugin that never touched a file declares it complete with no
 * entry, which claims its output is a function of the file itself plus the
 * compiler options. Deriving nothing at all here would be wrong in the other
 * direction, since a tsconfig edit still changes that output.
 *
 * 1. Run fixture entries that stamp a graph and declare `src/main.ts` complete,
 *    without any `emit-dependencies` entry.
 * 2. Collect addWatchFile invocations.
 * 3. Assert the tsconfig chain is the only registration.
 */
export const test_transformttsc_keeps_only_universal_inputs_for_a_complete_file_without_dependencies =
  async () => {
    await assertCompleteFileWithoutDependenciesKeepsOnlyUniversalInputs();
  };
