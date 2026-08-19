import { assertNotifiedAbsentCandidateIsNotReprobed } from "../../internal/transform-project-cache";

/**
 * Verifies a watched absent candidate costs no filesystem call per delivery.
 *
 * The residual samchon/ttsc#1261 is about, measured after #1266: a missing
 * resolution candidate cannot be proven by the metadata signature every other
 * input uses, so each delivery re-probes it, and no producer declaration can
 * remove it because candidates stay host-owned. The generation's own watcher
 * already answers the question once for all deliveries.
 *
 * 1. Build a project whose envelope stamps missing candidates.
 * 2. Deliver one module to capture the generation, then reset the counters.
 * 3. Deliver the rest and assert no candidate path was touched.
 */
export const test_transformttsc_notified_absent_candidate_is_not_reprobed =
  async () => {
    await assertNotifiedAbsentCandidateIsNotReprobed();
  };
