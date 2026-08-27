import { assertPersistentUtilityConfigLinkRetargetInvalidatesTransform } from "../../internal/transform-utility-plugin-config";

/** A config link retarget during evaluation is stabilized before delivery. */
export const test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation =
  async () => {
    await assertPersistentUtilityConfigLinkRetargetInvalidatesTransform();
  };
