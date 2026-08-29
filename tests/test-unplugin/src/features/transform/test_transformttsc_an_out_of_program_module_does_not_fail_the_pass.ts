import { assertAnOutOfProgramModuleDoesNotFailThePass } from "../../internal/transform-terminal-verdict";

/**
 * Verifies a module the compile has no output for does not fail the whole pass.
 *
 * The boundary of what a pass verdict may cover. `selectTransformedSource`
 * throws from three places and only two of them say anything about the
 * generation; the third says one file has no output, which is an ordinary
 * condition for a module the bundle reaches but the tsconfig program does not
 * contain. Retaining that as a pass verdict would reject every later module
 * with an error naming a file none of them asked about.
 *
 * 1. Plant a `.ts` file under the project root but outside the tsconfig include.
 * 2. Open a pass, deliver a real module, then deliver the planted one.
 * 3. Assert it reports itself and every remaining module is still served.
 */
export const test_transformttsc_an_out_of_program_module_does_not_fail_the_pass =
  async () => {
    await assertAnOutOfProgramModuleDoesNotFailThePass();
  };
