import type { TtscLintConfigEntry } from "./TtscLintConfigEntry";
import type { TtscLintPlugins } from "./TtscLintPlugins";
import type { TtscLintRuleMap } from "./TtscLintRuleMap";

/**
 * Top-level config accepted by `@ttsc/lint`.
 *
 * Three accepted forms, listed in expected order of preference:
 *
 * 1. **Flat-config array** — mirrors ESLint flat config exactly. Each entry can
 *    scope by `files` / `ignores`, declare a `plugins` map of contributors,
 *    configure `rules`, and configure formatting through the Prettier-style
 *    {@link TtscLintFormatConfig | `format`} block. Multiple entries layer in
 *    order.
 * 2. **Single config object** — same shape as one flat-config entry. Useful when
 *    the project has no per-file scoping. Pass `format: { … }` here for the
 *    smallest "describe my style" config.
 * 3. **Rules-only map** — historical shape kept for backward compat with
 *    single-file projects. `{"no-var":"error"}` is interpreted as `[{rules:
 *    {"no-var":"error"}}]`. The shorthand intentionally has no slot for the
 *    `format` block — use form (1) or (2) to enable formatting.
 *
 * The generic parameter `P` lets `defineConfig` capture the literal plugin
 * object types declared in `plugins`. When non-empty, rule-name keys
 * autocomplete as `BuiltInRule | "<ns>/<rule>"` where the namespace-rule
 * combinations come from each plugin's `rules` tuple.
 */
export type TtscLintConfig<P extends TtscLintPlugins = Record<string, never>> =
  | TtscLintRuleMap<P>
  | TtscLintConfigEntry<P>
  | readonly TtscLintConfigEntry<P>[];
