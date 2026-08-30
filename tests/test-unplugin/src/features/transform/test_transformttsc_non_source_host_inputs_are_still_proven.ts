import { assertNonSourceHostInputsAreStillProven } from "../../internal/transform-program-membership";

/**
 * See {@link assertNonSourceHostInputsAreStillProven}: the walk stopped hashing
 * files that cannot enter the program, which is safe only because the
 * compiler's non-source inputs are proven by the universal host-input path
 * instead (samchon/ttsc#1307).
 */
export const test_transformttsc_non_source_host_inputs_are_still_proven =
  async () => {
    await assertNonSourceHostInputsAreStillProven();
  };
