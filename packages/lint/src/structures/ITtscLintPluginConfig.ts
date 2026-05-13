import type { TtscLintConfig } from "./TtscLintConfig";

/** `compilerOptions.plugins[]` entry shape consumed by `@ttsc/lint`. */
export interface ITtscLintPluginConfig {
  /** Set to `false` to keep the entry while disabling this plugin. */
  enabled?: boolean;

  /** Plugin module specifier. */
  transform?: string;

  /**
   * Inline rule map or path to a standalone lint config file.
   *
   * Inline maps are passed to the native sidecar through `--plugins-json`.
   * String values are resolved by the sidecar from the owning tsconfig
   * directory and may point at JSON, JavaScript, or TypeScript config files.
   */
  config?: string | TtscLintConfig;

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
   *   "plugins": {
   *     "demo": "ttsc-lint-plugin-demo"
   *   },
   *   "config": { "demo/no-todo-comment": "error" }
   * }
   * ```
   */
  plugins?: Record<string, string>;

  /** Extra plugin-owned fields are passed through unchanged. */
  [key: string]: unknown;
}
