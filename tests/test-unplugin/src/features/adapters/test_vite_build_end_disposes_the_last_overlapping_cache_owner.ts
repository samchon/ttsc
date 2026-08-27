import { assertViteBuildEndDisposesTheLastOverlappingCacheOwner } from "../../internal/adapter-vite-lifecycle";

/**
 * Verifies Vite buildEnd disposes cache trackers without breaking restarts.
 *
 * Vite can end a container that never started, and a restart creates the
 * replacement container before the old started container ends. Cache disposal
 * must ignore the non-owner, retain a live replacement, and clear the cache
 * when the final owner closes.
 *
 * 1. End an unstarted neighbour and prove the current cache remains live.
 * 2. Start a replacement, end the old owner, and prove replacement reuse.
 * 3. End the final owner and prove a later delivery starts a new generation.
 */
export const test_vite_build_end_disposes_the_last_overlapping_cache_owner =
  async () => {
    await assertViteBuildEndDisposesTheLastOverlappingCacheOwner();
  };
