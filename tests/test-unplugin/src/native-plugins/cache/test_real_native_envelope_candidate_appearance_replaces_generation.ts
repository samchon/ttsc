import { assertRealEnvelopeCandidateAppearanceReplacesGeneration } from "../../internal/real-native-envelope";

/**
 * Verifies a real superseding candidate replaces the persistent generation.
 *
 * Candidate-only paths without compiler proofs are allowed to enter the cache,
 * but that admission must not serve stale resolution after a higher-priority
 * package source appears. This is the freshness twin of the one-compile gate.
 *
 * 1. Deliver one importer and prove the production envelope and first run.
 * 2. Create the missing `index.ts` above the selected package `index.js`.
 * 3. Deliver the remaining importers and require one replacement compile only.
 */
export const test_real_native_envelope_candidate_appearance_replaces_generation =
  async () => {
    await assertRealEnvelopeCandidateAppearanceReplacesGeneration();
  };
