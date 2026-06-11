import { assertGeneratedTsconfigOmitsBaseUrl } from "../../internal/transform-generated-tsconfig-shape";

/**
 * Verifies the generated transform tsconfig omits `baseUrl` and writes absolute
 * alias `paths` targets.
 *
 * Regression guard for samchon/ttsc#205's root cause at the config-shape level:
 * TypeScript-Go removed `baseUrl` (TS5102) and rejects bare non-relative
 * `paths` targets (TS5090), and the generated tsconfig lives in a system temp
 * directory where `./`-relative targets would anchor at the wrong place.
 * Absolute targets are the only safe encoding; any reappearing `baseUrl`
 * injection breaks every aliased transform.
 *
 * 1. Create a fixture project and forward a bundler alias.
 * 2. Run the transform with the fixture plugin's `assert-absolute-alias-paths`
 *    operation.
 * 3. The plugin fails the transform unless the generated tsconfig has no `baseUrl`
 *    and the alias target is absolute; assert the transform succeeded.
 */
export const test_transformttsc_generated_tsconfig_omits_baseurl_and_uses_absolute_alias_targets =
  async () => {
    await assertGeneratedTsconfigOmitsBaseUrl();
  };
