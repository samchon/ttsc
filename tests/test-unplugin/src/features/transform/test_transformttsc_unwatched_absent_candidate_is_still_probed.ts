import { assertUnwatchedAbsentCandidateIsStillProbed } from "../../internal/transform-project-cache";

/**
 * Verifies a candidate whose watch could not be opened is still checked.
 *
 * The negative twin of the notification proof in samchon/ttsc#1261: only a
 * candidate the tracker actually covers may skip its own check, so a host that
 * refuses watch registrations — inotify exhausted, a network filesystem, a
 * sandbox — must fall back to asking the filesystem rather than trusting a
 * channel that was never opened.
 *
 * 1. Build a project with missing candidates and a cache whose watch fails.
 * 2. Deliver one module to capture the generation, then reset the counters.
 * 3. Deliver the rest and assert the candidate paths were checked.
 */
export const test_transformttsc_unwatched_absent_candidate_is_still_probed =
  async () => {
    await assertUnwatchedAbsentCandidateIsStillProbed();
  };
