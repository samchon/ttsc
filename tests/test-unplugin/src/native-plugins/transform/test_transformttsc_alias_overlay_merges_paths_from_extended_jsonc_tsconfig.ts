import assert from "node:assert/strict";

import { createAliasProject } from "../../internal/transform-alias-resolution/createAliasProject";
import { transformMain } from "../../internal/transform-alias-resolution/transformMain";

/**
 * Verifies the alias overlay merges `paths` declared in an extended JSONC base
 * config.
 *
 * The overlay re-states the project's effective `paths` because the generated
 * tsconfig replaces them wholesale. It must walk the `extends` chain, tolerate
 * comments and trailing commas, and anchor relative targets at the declaring
 * config's directory, one level below the project root here. The probe is a
 * deliberate type error that can only be reported if the alias resolved to the
 * real type.
 *
 * 1. Create an alias project whose `paths` live in an extended JSONC base under
 *    `config/`.
 * 2. Transform a source that misuses a type imported through that alias.
 * 3. Assert the transform rejects with the type error.
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
