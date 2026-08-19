import { assertUnrelatedFileInAProbedDirectoryKeepsTheGeneration } from "../../internal/transform-utility-plugin-config";

/**
 * Verifies a neighbour of a probed config candidate does not invalidate.
 *
 * The twin of the supersession case in samchon/ttsc#1271. Reporting the
 * rejected candidates makes a set of paths matter that did not before, and a
 * generation that woke for any file beside them would trade one defect for a
 * worse one, since those are ordinary directories with ordinary traffic.
 *
 * 1. Compile a package nested below its banner config.
 * 2. Write an unrelated file into the directory the walk probed.
 * 3. Assert the generation object is the same one and the output unchanged.
 */
export const test_transformttsc_unrelated_file_in_a_probed_directory_keeps_the_generation =
  async () => {
    await assertUnrelatedFileInAProbedDirectoryKeepsTheGeneration();
  };
