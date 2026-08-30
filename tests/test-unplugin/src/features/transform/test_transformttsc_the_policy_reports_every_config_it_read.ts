import { assertThePolicyReportsEveryConfigItRead } from "../../internal/transform-program-membership";

/**
 * See {@link assertThePolicyReportsEveryConfigItRead}: a memoized policy can
 * only be invalidated by what it reports, and the options it resolves come from
 * the whole `extends` chain (samchon/ttsc#1307).
 */
export const test_transformttsc_the_policy_reports_every_config_it_read =
  async () => {
    await assertThePolicyReportsEveryConfigItRead();
  };
