/**
 * Raw `compilerOptions.plugins[]` entry read from tsconfig/jsconfig.
 *
 * ttsc owns `transform` and `enabled`; every other property belongs to the
 * plugin and is serialized unchanged into the native sidecar manifest.
 */
export interface ITtscProjectPluginConfig {
  /** Set to `false` to keep the entry while disabling it for ttsc. */
  enabled?: boolean;
  /** Plugin module specifier, relative path, or absolute path to load. */
  transform?: string;
  /** Plugin-specific config passed through unchanged to the native sidecar. */
  [key: string]: unknown;
}
