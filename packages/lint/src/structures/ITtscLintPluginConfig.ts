/**
 * `compilerOptions.plugins[]` entry shape consumed by `@ttsc/lint`.
 *
 * @evidence contracts/common.md#principled-implementation The host entry carries activation and discovery identity plus a config-file pointer; lint policy belongs to the loaded config.
 * @evidence contracts/common.md#clear-and-simple-design The three entry fields keep host activation separate from the larger lint configuration schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No inline rule escape hatch bypasses config-file validation or contributor discovery.
 * @evidence contracts/common.md#meaningful-documentation Member comments explain disabling, relative discovery and supported extensions with a config example; blank member and tag boundaries follow documentation guidance.
 */
export interface ITtscLintPluginConfig {
  /** Set to `false` to keep the entry while disabling this plugin. */
  enabled?: boolean;

  /** Plugin module specifier. */
  transform?: string;

  /**
   * Path to the lint config file, overriding auto-discovery.
   *
   * Relative paths are resolved from the caller-declared plugin config
   * directory when supplied, otherwise the tsconfig directory. Absolute paths
   * are used as-is. Accepts the usual `lint.config.*` / `ttsc-lint.config.*`
   * extensions (`.ts`, `.cts`, `.mts`, `.js`, `.cjs`, `.mjs`, `.json`).
   *
   * When omitted, `@ttsc/lint` walks upward from that caller-declared directory
   * when supplied. Otherwise it walks from the tsconfig directory and, when
   * that finds none, from the working directory, looking for `lint.config.*` or
   * `ttsc-lint.config.*`.
   *
   * ```jsonc
   * {
   *   "transform": "@ttsc/lint",
   *   "configFile": "./lint.config.ts"
   * }
   * ```
   *
   * Every rule, format, and contributor setting lives in the config file. The
   * only lint-specific setting in this entry is `configFile`; `enabled` and
   * `transform` are host-owned fields.
   */
  configFile?: string;
}
