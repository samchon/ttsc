import assert from "node:assert/strict";

import { createAliasProject } from "../../../../internal/unplugin/internal/transform-alias-resolution/createAliasProject";
import { transformMain } from "../../../../internal/unplugin/internal/transform-alias-resolution/transformMain";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Mis-typed aliased Foo rejects not assignable; well-typed twin transforms unchanged and returns undefined.
 * @evidence contracts/testing.md#independent-expectations Authored Foo interface numeric id/string name defines independent type-checking oracle; any-collapse would accept bad twin.
 * @evidence contracts/testing.md#distinguishing-cases Overlapping tsconfig/bundler alias, invalid typed value and valid adjacent twin.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_resolves_types_through_alias_overlapping_tsconfig_paths is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built public transformation invokes actual config discovery/overlay and native compiler or fixture plugin. The assertions establish that the selected config/alias reaches that producer, beyond portable option calculations.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API serve this entry's transformations; related repeats reuse configuration/artifact setup. Changed source/options need separate producer calls only for the distinctions above. Portable option policy is not claimed as a separate native boundary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Mis-typed aliased Foo rejects not assignable; well-typed twin transforms unchanged and returns undefined. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
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
