import { assertPersistentUtilityConfigLinkRetargetInvalidatesTransform } from "../../internal/transform-utility-plugin-config";

/**
 * Verifies a utility-config link retarget stabilizes before delivery.
 *
 * Equal bytes behind a retargeted lexical link do not preserve relative
 * dependency identity. A retarget during config evaluation must discard that
 * attempt instead of publishing output from the earlier target.
 *
 * 1. Retarget the config link while the first plugin attempt evaluates it.
 * 2. Assert the first delivery already comes from the stable retry.
 * 3. Retarget again and assert one replacement generation stabilizes likewise.
 */
export const test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation =
  async () => {
    await assertPersistentUtilityConfigLinkRetargetInvalidatesTransform();
  };
