import type { TtscLintConfig } from "./structures/TtscLintConfig";
import type { TtscLintPlugins } from "./structures/TtscLintPlugins";

/**
 * Authoring helper that preserves the literal type of a lint config.
 *
 * ESLint's flat-config experience relies on `defineConfig` to capture the
 * const-narrowed type of the configuration array, which is what makes plugin
 * rule names autocomplete across entries. `@ttsc/lint` follows the same
 * pattern: pass your config through this helper and the contributor plugin
 * objects in `plugins` propagate their `rules` tuples into the rule-name
 * union.
 *
 * ```ts
 * import { defineConfig } from "@ttsc/lint";
 * import importPlugin from "@ttsc/lint-plugin-import";
 *
 * export default defineConfig([
 *   {
 *     plugins: { import: importPlugin },
 *     rules: {
 *       "no-var": "error",
 *       "import/no-cycle": ["error", { maxDepth: 1 }],
 *     },
 *   },
 * ]);
 * ```
 *
 * The function is a pure pass-through at runtime; its only purpose is to teach
 * the type checker that the argument is a `const` value so literal tuple types
 * in `plugins[ns].rules` remain readable for the rule-name union math.
 */
export function defineConfig<const T extends TtscLintConfig<TtscLintPlugins>>(
  config: T,
): T {
  return config;
}
