import { assertAPassIgnoresAnAppearingOutputDirectory } from "../../internal/transform-delivery-epoch/assertAPassIgnoresAnAppearingOutputDirectory";

/**
 * Verifies a pass keeps the generation when a bundler creates its output
 * directory inside the project.
 *
 * The membership proof has to honour the same ignore list the walk does. A
 * directory's own stamp moves whenever any entry is added or removed, including
 * the ones the walk exists to ignore, so comparing raw directory metadata meant
 * a bundler emitting into `dist/` — or merely creating it for the first time —
 * moved the project root's stamp and voided a generation no compiler input had
 * touched. That is not a corner case: it is what every host that writes its
 * bundle into the project does on its first build, which is precisely the build
 * before the first rebuild this whole change exists to make cheap.
 *
 * Its negative twin is {@link assertAPassRecompilesAfterAMembershipChange}: a
 * file the walk does consider must still replace the generation.
 */
export async function test_transformttsc_a_build_pass_ignores_an_appearing_output_directory(): Promise<void> {
  await assertAPassIgnoresAnAppearingOutputDirectory();
}
