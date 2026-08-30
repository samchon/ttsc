import { assertRecreatingTheOutputDirectoryCostsNothing } from "../../internal/transform-program-membership";

/**
 * See {@link assertRecreatingTheOutputDirectoryCostsNothing}: `emptyOutDir` and
 * `output.clean` recreate the output directory on every build, and the live
 * tracker must answer that the same way the membership digest does
 * (samchon/ttsc#1307).
 */
export const test_transformttsc_recreating_the_output_directory_costs_nothing =
  async () => {
    await assertRecreatingTheOutputDirectoryCostsNothing();
  };
