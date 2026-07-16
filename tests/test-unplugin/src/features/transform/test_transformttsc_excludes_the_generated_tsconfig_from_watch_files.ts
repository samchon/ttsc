import { assertGeneratedTsconfigIsNotRegistered } from "../../internal/transform-graph";

/**
 * Verifies transformTtsc drops the generated temp-dir tsconfig from the
 * graph-derived watch inputs.
 *
 * A `compilerOptions` overlay makes the adapter compile through a tsconfig
 * generated in the system temp directory, and the host's `graph.configs` chain
 * names that file — but it is disposed right after the compile. Registering a
 * deleted, per-build-random path as a watch input would invalidate every
 * persistent-cache snapshot on the next build, silently defeating the cache the
 * graph exists to make sound.
 *
 * 1. Force a generated tsconfig with a `compilerOptions` overlay and have the
 *    fixture echo the host-provided `--tsconfig` path into `graph.configs`.
 * 2. Collect addWatchFile invocations.
 * 3. Assert the graph edge still registers while the temp path does not.
 */
export const test_transformttsc_excludes_the_generated_tsconfig_from_watch_files =
  async () => {
    await assertGeneratedTsconfigIsNotRegistered();
  };
