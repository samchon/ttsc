import type { ITtscProjectPluginConfig } from "ttsc";

import type { TtscLintConfig } from "./TtscLintConfig";

/** `compilerOptions.plugins[]` entry shape consumed by `@ttsc/lint`. */
export interface ITtscLintPluginConfig extends ITtscProjectPluginConfig {
  /**
   * Inline rule map or path to a JSON config file.
   *
   * Inline maps are passed to the native sidecar through `--plugins-json`.
   * String values are resolved by the sidecar from the project root.
   */
  config?: string | TtscLintConfig;
}
