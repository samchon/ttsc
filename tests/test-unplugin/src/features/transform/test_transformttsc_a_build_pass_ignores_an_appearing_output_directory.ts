import { assertAPassIgnoresAnAppearingOutputDirectory } from "../../internal/transform-delivery-epoch";

/**
 * Verifies a bundler's own output directory does not void the generation.
 *
 * The membership proof has to honour the same ignore list the project walk
 * does. A directory's stamp moves whenever any entry is added or removed,
 * including the ones the walk exists to ignore, so comparing raw directory
 * metadata meant a host emitting into `dist/` — or merely creating it for the
 * first time — moved the project root's stamp and voided a generation no
 * compiler input had touched. That is what every host writing its bundle into
 * the project does on its first build, which is the build immediately before
 * the first rebuild this change exists to make cheap.
 *
 * 1. Deliver every module inside one pass.
 * 2. Create `dist`, `out`, `coverage` and `.cache` with a file in each.
 * 3. Open a second pass and assert no second whole-project compile.
 */
export const test_transformttsc_a_build_pass_ignores_an_appearing_output_directory =
  async () => {
    await assertAPassIgnoresAnAppearingOutputDirectory();
  };
