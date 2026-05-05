import type { ITtscProjectPluginConfig } from "ttsc";

import type { TtscLintConfig } from "./TtscLintConfig";

/** `compilerOptions.plugins[]` entry shape consumed by `@ttsc/lint`. */
export interface ITtscLintPluginConfig extends ITtscProjectPluginConfig {
  /**
   * Inline rule map or path to a standalone lint config file.
   *
   * Inline maps are passed to the native sidecar through `--plugins-json`.
   * String values are resolved by the sidecar from the owning tsconfig
   * directory and may point at JSON, JavaScript, or TypeScript config files.
   */
  config?: string | TtscLintConfig;
}
