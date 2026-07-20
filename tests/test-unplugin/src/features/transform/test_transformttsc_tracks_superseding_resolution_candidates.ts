import { assertTransformTracksSupersedingResolutionCandidates } from "../../internal/transform-resolution-candidates";

/**
 * Verifies an in-process transform cache misses and the adapter registers a
 * watch input when only a higher-priority, formerly missing module candidate
 * appears between two transforms of the same source file.
 *
 * The cache cannot learn this change from the importer or tsconfig because both
 * remain byte-identical. It must preserve the compiler-provided missing path as
 * an input until the next transform observes the different resolution.
 *
 * 1. Transform once with the missing candidate recorded in the graph envelope.
 * 2. Create only that candidate and transform the unchanged source again.
 * 3. Assert the cache recompiles and the adapter registered the candidate.
 */
export const test_transformttsc_tracks_superseding_resolution_candidates =
  async () => {
    await assertTransformTracksSupersedingResolutionCandidates();
  };
