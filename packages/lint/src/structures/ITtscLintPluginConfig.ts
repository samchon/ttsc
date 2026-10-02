/**
 * `compilerOptions.plugins[]` entry shape consumed by `@ttsc/lint`.
 *
 * @evidence contracts/common.md#principled-implementation The host entry carries activation and discovery identity plus a config-file pointer; lint policy belongs to the loaded config.
 * @evidence contracts/common.md#clear-and-simple-design The three entry fields keep host activation separate from the larger lint configuration schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No inline rule escape hatch bypasses config-file validation or contributor discovery.
 * @evidence contracts/common.md#meaningful-documentation Member comments explain disabling, relative discovery and supported extensions with a config example; blank member and tag boundaries follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintPluginConfig is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintPluginConfig is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintPluginConfig is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintPluginConfig is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintPluginConfig {
  /** Set to `false` to keep the entry while disabling this plugin. */
  enabled?: boolean;

  /** Plugin module specifier. */
  transform?: string;

  /**
   * Path to the lint config file, overriding auto-discovery.
   *
   * Relative paths are resolved from the tsconfig directory; absolute paths are
   * used as-is. Accepts the usual `lint.config.*` / `ttsc-lint.config.*`
   * extensions (`.ts`, `.cts`, `.mts`, `.js`, `.cjs`, `.mjs`, `.json`).
   *
   * When omitted, `@ttsc/lint` discovers a `lint.config.*` /
   * `ttsc-lint.config.*` file by walking upward from the tsconfig directory and,
   * when that finds none, from the working directory.
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
