import type { TtscLintConfigEntry } from "./TtscLintConfigEntry";
import type { TtscLintPlugins } from "./TtscLintPlugins";
import type { TtscLintRuleMap } from "./TtscLintRuleMap";

/**
 * Top-level config accepted by `@ttsc/lint`.
 *
 * Three accepted forms, listed in expected order of preference:
 *
 * 1. **Flat-config array** — mirrors ESLint flat config exactly. Each entry can
 *    scope its rules by `files` / `ignores`, declare a `plugins` map of
 *    contributors, and configure `rules`. Multiple entries layer in order.
 * 2. **Single config object** — same shape as one flat-config entry. Useful when
 *    the project has no per-file scoping.
 * 3. **Rules-only map** — historical shape kept for backward compat with
 *    single-file projects. `{"no-var":"error"}` is interpreted as `[{rules:
 *    {"no-var":"error"}}]`.
 *
 * The generic parameter `P` lets `defineConfig` capture the literal plugin
 * object types declared in `plugins`. When non-empty, rule-name keys
 * autocomplete as `BuiltInRule | "<ns>/<rule>"` where the namespace-rule
 * combinations come from each plugin's `rules` tuple.
 */
export type TtscLintConfig<P extends TtscLintPlugins = TtscLintPlugins> =
  | TtscLintRuleMap<P>
  | TtscLintConfigEntry<P>
  | readonly TtscLintConfigEntry<P>[];
