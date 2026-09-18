import { assertPersistentUtilityConfigLinkRetargetInvalidatesTransform } from "../../internal/transform-utility-plugin-config/assertPersistentUtilityConfigLinkRetargetInvalidatesTransform";

/** Assert an evaluation-time directory-link retarget cannot bless stale output. */
export async function test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation(): Promise<void> {
  await assertPersistentUtilityConfigLinkRetargetInvalidatesTransform();
}
