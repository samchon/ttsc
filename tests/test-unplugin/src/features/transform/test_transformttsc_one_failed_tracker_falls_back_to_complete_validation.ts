import { assertOneFailedTrackerFallsBackToCompleteValidation } from "../../internal/transform-project-cache";

/**
 * Verifies one unusable tracker leaves the narrow path without losing the
 * cache.
 *
 * Membership has two halves, the project walk and the universal inputs, and a
 * generation may validate narrowly only while notifications still prove both.
 * The neighbouring cases refuse or fail every watcher at once, so a regression
 * that consulted a single tracker would keep them green while serving modules
 * whose universal inputs nothing is watching.
 *
 * 1. Refuse the first generation's host-input watch registrations, and only those,
 *    through the cache-owned seam.
 * 2. Deliver every module and assert one compile plus neither tracker attached.
 * 3. Edit a project source and assert the fallback still invalidates.
 */
export const test_transformttsc_one_failed_tracker_falls_back_to_complete_validation =
  async () => {
    await assertOneFailedTrackerFallsBackToCompleteValidation();
  };
