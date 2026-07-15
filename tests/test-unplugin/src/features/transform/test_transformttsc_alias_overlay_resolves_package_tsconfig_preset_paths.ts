import { assertAliasOverlayResolvesPackageTsconfigPresetPaths } from "../../internal/transform-alias-resolution";

/**
 * Verifies the alias overlay preserves paths from a package.json#tsconfig
 * preset (#686).
 *
 * A bare `extends` specifier may name an npm preset that selects its config
 * file through `package.json#tsconfig` and ships no JS/JSON entrypoint. The
 * unplugin paths reader approximated bare resolution with Node's entrypoint
 * resolver and a `<specifier>.json` fallback, both of which miss such a preset,
 * so its inherited `paths` silently disappeared from the transform overlay and
 * aliased imports collapsed to `any`. The reader must honor
 * `package.json#tsconfig` like `tsc`, anchoring inherited relative targets at
 * the preset's directory.
 *
 * 1. Build a project extending a bare manifest-selected preset that declares a
 *    `#preset/*` alias and ships its target type.
 * 2. Transform a module whose deliberate type error rides the inherited alias
 *    (forwarding a bundler alias to trigger the overlay).
 * 3. Assert the type error surfaces (alias resolved) and that well-typed source
 *    transforms cleanly (no spurious overlay diagnostics).
 */
export const test_transformttsc_alias_overlay_resolves_package_tsconfig_preset_paths =
  async () => {
    await assertAliasOverlayResolvesPackageTsconfigPresetPaths();
  };
