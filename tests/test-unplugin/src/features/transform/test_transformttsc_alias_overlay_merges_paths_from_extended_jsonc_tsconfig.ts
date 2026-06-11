import { assertAliasOverlayMergesExtendedJsoncPaths } from "../../internal/transform-alias-resolution";

/**
 * Verifies the alias overlay merges `paths` declared in an extended JSONC base
 * tsconfig.
 *
 * Locks the `extends`-chain walk in `tsconfigPaths.ts`: monorepos commonly
 * declare `paths` in a shared base config, with comments and trailing commas,
 * sitting in a different directory than the entry tsconfig. The overlay must
 * find that declaration and keep its relative targets anchored at the declaring
 * config's directory — TypeScript-Go resolves inherited relative `paths`
 * against the declaring file, not the extending one.
 *
 * 1. Create a project whose `paths` live in `config/tsconfig.base.json` (JSONC:
 *    comments + trailing commas), referenced via `extends`.
 * 2. Transform a source with a type error through the tsconfig-only `#lib/*`
 *    mapping while forwarding a bundler alias for `@`.
 * 3. Assert the type error is reported — the base-declared mapping survived.
 */
export const test_transformttsc_alias_overlay_merges_paths_from_extended_jsonc_tsconfig =
  async () => {
    await assertAliasOverlayMergesExtendedJsoncPaths();
  };
