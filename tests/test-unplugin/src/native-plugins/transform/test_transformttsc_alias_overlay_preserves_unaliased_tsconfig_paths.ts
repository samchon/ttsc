import assert from "node:assert/strict";

import { createAliasProject } from "../../internal/transform-alias-resolution/createAliasProject";
import { transformMain } from "../../internal/transform-alias-resolution/transformMain";

/**
 * Verifies a tsconfig-only `paths` key keeps resolving while the alias overlay
 * is active.
 *
 * The generated tsconfig replaces `paths` wholesale through `extends`
 * semantics, so the overlay must re-state the project's own mappings, or an
 * import through `#lib/*`, absent from the bundler aliases, silently resolves
 * to `any`. The probe is a deliberate type error that can only be reported if
 * the alias resolved.
 *
 * 1. Create an alias project with a tsconfig-only `#lib/*` mapping.
 * 2. Transform a source that misuses a type imported through it.
 * 3. Assert the transform rejects with the type error.
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
