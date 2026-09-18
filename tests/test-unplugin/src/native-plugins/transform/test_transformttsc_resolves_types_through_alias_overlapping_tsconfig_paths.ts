import assert from "node:assert/strict";

import { createAliasProject } from "../../internal/transform-alias-resolution/createAliasProject";
import { transformMain } from "../../internal/transform-alias-resolution/transformMain";

/**
 * Verifies a type imported through an alias present in both tsconfig `paths`
 * and the bundler aliases still resolves (samchon/ttsc#205).
 *
 * Before the fix the generated overlay broke resolution, since `baseUrl` is
 * removed (TS5102) and bare relative targets are rejected in the temp directory
 * (TS5090), so the type collapsed to `any` and no error surfaced. The probe is
 * a deliberate type error that can only be reported when the alias resolved to
 * the real interface, and its well-typed twin pins that the overlay adds no
 * diagnostics of its own.
 *
 * 1. Create a project whose `@/*` alias is declared in both tsconfig `paths` and
 *    the bundler aliases.
 * 2. Transform a source that misuses a type imported through it, and assert it
 *    rejects.
 * 3. Transform a well-typed twin and assert it passes.
 */
export async function test_transformttsc_resolves_types_through_alias_overlapping_tsconfig_paths(): Promise<void> {
  const root = createAliasProject();
  await assert.rejects(
    () =>
      transformMain(
        root,
        [
          'import type { Foo } from "@/types";',
          'export const bad: Foo = { id: "oops", name: 42 };',
          "",
        ].join("\n"),
      ),
    /not assignable/,
  );
  const clean = await transformMain(
    root,
    [
      'import type { Foo } from "@/types";',
      'export const good: Foo = { id: 1, name: "fine" };',
      "",
    ].join("\n"),
  );
  // No plugins are configured, so a clean transform leaves the source as-is.
  assert.equal(clean, undefined);
}
