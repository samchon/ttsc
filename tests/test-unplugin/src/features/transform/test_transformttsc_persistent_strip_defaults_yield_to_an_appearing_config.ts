import { assertPersistentStripDefaultsYieldToAnAppearingConfig } from "../../internal/transform-utility-plugin-config";

/**
 * Verifies a strip config appearing after a defaults-only generation takes
 * effect.
 *
 * The boundary of samchon/ttsc#1271 where the search found nothing at all:
 * `@ttsc/strip` falls back to its built-in defaults, which is exactly the state
 * a config appearing later changes. Nothing was reported for that search, so a
 * warm generation kept stripping under the defaults and shipped code the new
 * config says to keep.
 *
 * 1. Compile a project with no strip config anywhere up the tree, so the defaults
 *    strip `console.log`.
 * 2. Write a `strip.config.json` that strips `logger.trace` instead.
 * 3. Assert the next delivery keeps `console.log` and drops `logger.trace`.
 */
export const test_transformttsc_persistent_strip_defaults_yield_to_an_appearing_config =
  async () => {
    await assertPersistentStripDefaultsYieldToAnAppearingConfig();
  };
