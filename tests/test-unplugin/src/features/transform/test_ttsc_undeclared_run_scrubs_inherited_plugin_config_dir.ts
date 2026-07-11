import { assertUndeclaredRunScrubsInheritedPluginConfigDir } from "../../internal/transform-plugin-config-dir-scrub";

/**
 * Verifies ttsc scrubs an inherited TTSC_PLUGIN_CONFIG_DIR from undeclared
 * runs.
 *
 * The plugin config anchor is per-invocation state: only the run that declared
 * `pluginConfigDir` may pass it on. A nested ttsc invocation (a config loader's
 * ttsx child, a plugin shelling back into ttsc) inherits the ancestor's
 * environment, and without the scrub its plugins would anchor config discovery
 * at the OUTER project instead of their own (samchon/ttsc#358 follow-through).
 *
 * 1. Create a fixture project whose plugin runs the `assert-no-plugin-config-dir`
 *    operation.
 * 2. Set `TTSC_PLUGIN_CONFIG_DIR` in the ambient environment and run
 *    `TtscCompiler.transform()` and `.compile()` without declaring
 *    `pluginConfigDir`.
 * 3. Assert both succeed — the fixture plugin fails the compile if the variable
 *    reaches it.
 */
export const test_ttsc_undeclared_run_scrubs_inherited_plugin_config_dir =
  async () => {
    await assertUndeclaredRunScrubsInheritedPluginConfigDir();
  };
