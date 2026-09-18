import assert from "node:assert/strict";

import { createAliasProject } from "../../internal/transform-alias-resolution/createAliasProject";
import { transformMain } from "../../internal/transform-alias-resolution/transformMain";

/**
 * Verifies that a tsconfig-only `paths` key (`#lib/*`, absent from the bundler
 * aliases) keeps resolving when the alias overlay is active. The generated
 * tsconfig replaces `paths` wholesale via `extends` semantics, so the overlay
 * must re-state the project's own mappings or this import silently breaks.
 */
export async function test_transformttsc_alias_overlay_preserves_unaliased_tsconfig_paths(): Promise<void> {
  const root = createAliasProject();
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
