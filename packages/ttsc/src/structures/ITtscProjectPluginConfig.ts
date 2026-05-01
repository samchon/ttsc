/**
 * Raw `compilerOptions.plugins[]` entry read from tsconfig/jsconfig.
 *
 * This is the project-facing config shape that users write in
 * `tsconfig.json`. ttsc deliberately keeps it open-ended because plugin
 * packages own their own config fields.
 *
 * ttsc interprets only two properties:
 *
 * - `transform`: the JavaScript module specifier used to load the plugin
 *   descriptor or factory.
 * - `enabled`: an opt-out switch that keeps the config entry in the file while
 *   preventing ttsc from loading it.
 *
 * Every other property is preserved as plugin config. After ttsc loads and
 * builds the plugin, the original entry is serialized into the native sidecar
 * manifest so Go code can read exactly the same plugin-specific options.
 */
export interface ITtscProjectPluginConfig {
  /**
   * Set to `false` to keep the entry while disabling it for ttsc.
   *
   * This is useful for sharing one tsconfig across environments while turning
   * selected plugins on or off without deleting their config.
   */
  enabled?: boolean;

  /**
   * Plugin module specifier, relative path, or absolute path to load.
   *
   * Relative paths are resolved from the resolved project root, which is the
   * directory containing the active tsconfig/jsconfig. Package specifiers are
   * resolved with Node's package resolution from that same project root.
   *
   * The loaded JavaScript module must export an {@link ITtscPlugin} descriptor
   * or a `createTtscPlugin(context)` factory. The Go implementation itself is
   * declared by the descriptor's {@link ITtscPlugin.source} field.
   */
  transform?: string;

  /**
   * Plugin-specific config passed through unchanged to the native sidecar.
   *
   * ttsc does not validate these fields. Plugin packages should document their
   * own config contract and validate it inside their factory or Go sidecar.
   */
  [key: string]: unknown;
}
