import { assertAliasOverlayPreservesUnaliasedPaths } from "../../internal/transform-alias-resolution";

/**
 * Verifies the alias overlay preserves tsconfig `paths` keys that have no
 * bundler alias counterpart.
 *
 * The generated tsconfig `extends` the project one, and TypeScript merges
 * `compilerOptions` per option key — declaring `paths` in the overlay replaces
 * the project's `paths` wholesale. Locks the merge in
 * `transform.ts::createAliasCompilerOptions`: without re-stating the project's
 * effective mappings, every tsconfig-only alias would silently stop resolving
 * (the same `any`-collapse failure mode as samchon/ttsc#205).
 *
 * 1. Create a plugin-free project mapping both `@/*` and `#lib/*`.
 * 2. Transform a source with a type error through `#lib/other`, forwarding a
 *    bundler alias for `@` only.
 * 3. Assert the type error is reported — `#lib/*` still resolves.
 */
export const test_transformttsc_alias_overlay_preserves_unaliased_tsconfig_paths =
  async () => {
    await assertAliasOverlayPreservesUnaliasedPaths();
  };
