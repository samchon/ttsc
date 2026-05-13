import type { TtscLintRuleMap } from "./TtscLintRuleMap";

/** `compilerOptions.plugins[]` entry shape consumed by `@ttsc/lint`. */
export interface ITtscLintPluginConfig {
  /** Set to `false` to keep the entry while disabling this plugin. */
  enabled?: boolean;

  /** Plugin module specifier. */
  transform?: string;

  /**
   * Inline rule severity map applied to the project.
   *
   * Mirrors the `rules` field of an ESLint flat-config entry. When set, the
   * sidecar uses this map directly and does NOT consult any `lint.config.*`
   * file (use `extends` for that). Combine with `plugins` to register
   * contributor rule namespaces in the same entry.
   *
   * ```jsonc
   * {
   *   "transform": "@ttsc/lint",
   *   "rules": { "no-var": "error", "prefer-const": "warning" }
   * }
   * ```
   */
  rules?: TtscLintRuleMap;

  /**
   * Path to a standalone lint config file whose rules should be applied to this
   * project. Relative paths are resolved from the tsconfig directory. Accepts
   * the usual `lint.config.*` / `ttsc-lint.config.*` / `eslint.config.*`
   * extensions.
   *
   * Mirrors the `extends` field of an ESLint flat-config entry — "inherit this
   * file's configuration".
   *
   * ```jsonc
   * {
   *   "transform": "@ttsc/lint",
   *   "extends": "./lint.config.ts"
   * }
   * ```
   *
   * `rules` and `extends` are mutually exclusive on a single plugin entry; the
   * sidecar surfaces a loud error when both are set.
   */
  extends?: string;

  /**
   * Contributor lint plugins to compile into the `@ttsc/lint` binary.
   *
   * Each entry maps a namespace (rule-name prefix) to an npm specifier or
   * relative path. The factory resolves the package, reads its exported
   * `ITtscLintPlugin` descriptor, and forwards the Go source directory to
   * ttsc's plugin builder via the `contributors` field.
   *
   * ```jsonc
   * {
   *   "transform": "@ttsc/lint",
   *   "plugins": { "demo": "ttsc-lint-plugin-demo" },
   *   "rules": { "demo/no-todo-comment": "error" }
   * }
   * ```
   */
  plugins?: Record<string, string>;

  /**
   * Inline rule map or path to a standalone lint config file.
   *
   * @deprecated Use `rules` for inline severity maps or `extends` for a config
   *   file path. The sidecar maps a legacy `config` entry onto the appropriate
   *   new field and emits a one-time stderr deprecation notice. Removed in a
   *   future minor.
   *
   *   The legacy shape is intentionally narrower than `rules`/`extends`: a
   *   string (file path) or a flat rule-name → severity map. The Go-side
   *   parser only accepts those two shapes; widening the TS type to the new
   *   `TtscLintConfig` union would silently let `config: [{ rules: {...} }]`
   *   pass type-checking and fail at runtime.
   */
  config?: string | TtscLintRuleMap;

  /** Extra plugin-owned fields are passed through unchanged. */
  [key: string]: unknown;
}
