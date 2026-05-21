/** `compilerOptions.plugins[]` entry shape consumed by `@ttsc/lint`. */
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
   * `ttsc-lint.config.*` file by walking upward from the tsconfig directory.
   *
   * ```jsonc
   * {
   *   "transform": "@ttsc/lint",
   *   "configFile": "./lint.config.ts"
   * }
   * ```
   *
   * Every rule, format, and plugin setting lives in the config file — the
   * tsconfig plugin entry carries nothing but this pointer.
   */
  configFile?: string;
}
