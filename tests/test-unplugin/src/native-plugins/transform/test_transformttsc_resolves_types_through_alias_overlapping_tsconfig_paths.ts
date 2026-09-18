import assert from "node:assert/strict";

import { createAliasProject } from "../../internal/transform-alias-resolution/createAliasProject";
import { transformMain } from "../../internal/transform-alias-resolution/transformMain";

/**
 * Verifies the #205 regression: a type imported through an alias present in
 * BOTH tsconfig `paths` and the forwarded bundler aliases must still resolve.
 *
 * The probe is a deliberate type error through the aliased import: it can only
 * be reported when `Foo` resolved to the real interface. Before the fix the
 * generated overlay broke resolution (`baseUrl` is TS5102-removed and bare
 * relative targets are TS5090-rejected in the temp dir), the type collapsed to
 * `any`, and no error surfaced — the silent-no-op failure mode. The negative
 * twin (well-typed source passes cleanly) pins that the overlay introduces no
 * new diagnostics of its own.
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
