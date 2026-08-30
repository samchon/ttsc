import { assertUntranslatableAliasesAreReported } from "../../internal/transform-vite-aliases";

/**
 * Verifies an alias form a tsconfig `paths` map cannot express is reported.
 *
 * See {@link assertUntranslatableAliasesAreReported}: Vite's `RegExp` `find` and
 * a `find` containing `*` were both dropped in silence while both documents
 * described the forwarding without qualifying it (samchon/ttsc#1315).
 */
export const test_transformttsc_reports_untranslatable_vite_aliases =
  async () => {
    await assertUntranslatableAliasesAreReported();
  };
