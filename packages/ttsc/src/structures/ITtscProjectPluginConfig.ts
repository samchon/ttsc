/**
 * Raw plugin entry read from `compilerOptions.plugins[]` or from a directly
 * installed package's `package.json#ttsc.plugin` marker.
 *
 * This is the project-facing config shape that users write in `tsconfig.json`
 * or plugin packages expose through `package.json`. ttsc deliberately keeps it
 * open-ended because plugin packages own their own config fields.
 *
 * Ttsc interprets only two properties:
 *
 * - `transform`: the JavaScript module specifier used to load the plugin
 *   descriptor or factory.
 * - `enabled`: an opt-out switch that keeps the config entry in the file while
 *   preventing ttsc from loading it.
 *
 * Every other property is preserved as plugin config. After ttsc loads and
 * builds the plugin, the original entry is serialized into the native plugin
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
   * Relative paths are resolved from the tsconfig/jsconfig file that declared
   * the plugin entry. Package specifiers are resolved with Node's package
   * resolution from that same directory.
   *
   * The loaded JavaScript module must export an {@link ITtscPlugin} descriptor
   * or descriptor factory. The Go implementation itself is declared by the
   * descriptor's {@link ITtscPlugin.source} field.
   */
  transform?: string;

  /**
   * Plugin-specific config passed through unchanged to the native plugin.
   *
   * Ttsc does not validate these fields. Plugin packages should document their
   * own config contract and validate it inside their factory or Go source.
   */
  [key: string]: unknown;
}
