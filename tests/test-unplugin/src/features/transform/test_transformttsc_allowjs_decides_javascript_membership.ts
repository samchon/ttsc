import { assertAllowJsDecidesJavaScriptMembership } from "../../internal/transform-program-membership";

/**
 * See {@link assertAllowJsDecidesJavaScriptMembership} for what this proves and
 * why the previous behaviour was wrong (samchon/ttsc#1307).
 */
export const test_transformttsc_allowjs_decides_javascript_membership =
  async () => {
    await assertAllowJsDecidesJavaScriptMembership();
  };
