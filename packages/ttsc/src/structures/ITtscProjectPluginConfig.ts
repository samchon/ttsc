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
 *
 * @evidence contracts/common.md#principled-implementation Known transform/enabled fields describe host selection while an unknown-valued index signature preserves plugin-owned configuration without claiming the host validates it.
 * @evidence contracts/common.md#clear-and-simple-design Host-owned selectors and plugin-owned payload share the original entry, avoiding a second configuration projection that could discard plugin options.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The open payload is a documented extension boundary; plugin-specific validation belongs to the factory or native implementation rather than host special cases.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc states relative-resolution ownership, opt-out semantics and the validation responsibility for unknown fields; separate paragraphs, member spacing and a blank line before tags follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Transform accepts package specifiers and native relative/absolute paths; their resolution bases are explicit, and the host loader owns Node/native path resolution rather than requiring one separator spelling in this config type.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
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
