import { assertAliasOverlapResolvesTypes } from "../../internal/transform-alias-resolution";

/**
 * Verifies transformTtsc resolves types through an alias that overlaps a
 * tsconfig `paths` mapping.
 *
 * Regression for samchon/ttsc#205: the generated tsconfig overlay used to
 * inject a `baseUrl` (removed in TypeScript-Go, TS5102) and bare relative
 * `paths` targets (rejected from a temp directory, TS5090), so an import
 * aliased in BOTH Vite `resolve.alias` and tsconfig `paths` stopped resolving
 * and its type silently collapsed to `any` — typia validators became no-ops. A
 * deliberate type error through the aliased import can only be reported when
 * the type really resolved, which is what this test pins; the well-typed twin
 * pins that the overlay adds no diagnostics of its own.
 *
 * 1. Create a plugin-free project with `paths: { "@/*": ["./src/*"] }`.
 * 2. Transform a source with a type error through `@/types`, forwarding the
 *    overlapping bundler alias `@` → `<root>/src`.
 * 3. Assert the type error is reported, and a well-typed source passes.
 */
export const test_transformttsc_resolves_types_through_alias_overlapping_tsconfig_paths =
  async () => {
    await assertAliasOverlapResolvesTypes();
  };
