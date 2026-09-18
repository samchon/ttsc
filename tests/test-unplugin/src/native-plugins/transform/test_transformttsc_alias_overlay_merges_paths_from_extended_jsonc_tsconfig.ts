import assert from "node:assert/strict";

import { createAliasProject } from "../../internal/transform-alias-resolution/createAliasProject";
import { transformMain } from "../../internal/transform-alias-resolution/transformMain";

/**
 * Verifies the overlay merges `paths` declared in an extended JSONC base
 * config: the chain is walked, comments and trailing commas are tolerated, and
 * relative targets stay anchored at the declaring config's directory (the base
 * sits in `config/`, one level below the project root).
 */
export async function test_transformttsc_alias_overlay_merges_paths_from_extended_jsonc_tsconfig(): Promise<void> {
  const root = createAliasProject({ basePathsInExtendedJsonc: true });
  await assert.rejects(
    () =>
      transformMain(
        root,
        [
          'import type { Bar } from "#lib/other";',
          'export const bad: Bar = { flag: "oops" };',
          "",
        ].join("\n"),
      ),
    /not assignable/,
  );
}
