import { assertSynchronousMembershipChangeReachesTheNextDelivery } from "../../internal/transform-project-cache";

/**
 * Verifies a file created between two deliveries invalidates the second one.
 *
 * The property the mutation-settle barrier exists for, pinned where
 * samchon/ttsc#1272 replaced its fixed wait with the watcher's own
 * acknowledgement: a write returns before its event is applied, so a delivery
 * that read the verdict too early would serve a generation the new file already
 * invalidated.
 *
 * 1. Deliver one module so the generation is captured.
 * 2. Write a new source file into the project, synchronously.
 * 3. Deliver another module and assert the project recompiled.
 */
export const test_transformttsc_synchronous_membership_change_reaches_the_next_delivery =
  async () => {
    await assertSynchronousMembershipChangeReachesTheNextDelivery();
  };
