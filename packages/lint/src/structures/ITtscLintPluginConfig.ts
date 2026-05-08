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

  /** Extra plugin-owned fields are passed through unchanged. */
  [key: string]: unknown;
}
