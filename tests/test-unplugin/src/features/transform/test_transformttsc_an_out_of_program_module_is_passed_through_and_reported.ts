import { assertAnOutOfProgramModuleIsPassedThroughAndReported } from "../../internal/transform-program-output";

/**
 * Verifies a module the program does not contain passes through and is
 * reported.
 *
 * See {@link assertAnOutOfProgramModuleIsPassedThroughAndReported} for why one
 * condition used to have two answers across this repository's own packages
 * (samchon/ttsc#1308). Exercises the real native compiler, so it runs in CI.
 */
export const test_transformttsc_an_out_of_program_module_is_passed_through_and_reported =
  async () => {
    await assertAnOutOfProgramModuleIsPassedThroughAndReported();
  };
