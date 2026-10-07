/**
 * Raw plugin entry read from `compilerOptions.plugins[]` or from a directly
 * installed package's `package.json#ttsc.plugin` marker.
 *
 * This is the project-facing config shape that users write in `tsconfig.json`
 * or plugin packages expose through `package.json`. ttsc deliberately keeps it
 * open-ended because plugin packages own their own config fields.
 *
 * Two properties select whether and where ttsc loads the plugin:
 *
 * - `transform`: the JavaScript module specifier used to load the plugin
 *   descriptor or factory.
 * - `enabled`: an opt-out switch that keeps the config entry in the file while
 *   preventing ttsc from loading it.
 *
 * A conventional string `configFile` also registers a potential native input.
 * When no JavaScript loading stage consumed that path, its proof must come from
 * the consuming plugin; existing JavaScript observations keep their own proof
 * requirements. Relative values use the selected plugin config anchor, or the
 * selected project config's directory. Registration alone does not read the
 * file or certify its contents.
 *
 * Plugin-owned options are serialized into the native manifest. The
 * programmatic compiler captures JSON conversion at construction, so custom
 * `toJSON` behavior can define the serialized payload independently of the
 * host's loading selectors.
 *
 * @evidence contracts/common.md#principled-implementation Transform/enabled describe host selection and conventional configFile identifies potential native input proof without replacing consumed JavaScript observations; an unknown-valued index signature permits plugin-owned JSON configuration without claiming the host validates its meaning.
 * @evidence contracts/common.md#clear-and-simple-design One open entry shape holds loading selectors and plugin-owned options; constructor snapshotting separately owns captured JSON when programmatic conversion requires a distinct wire payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The open payload is a documented extension boundary; plugin-specific validation belongs to the factory or native implementation rather than host special cases.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc states resolution bases, opt-out semantics, deferred config-file proof and JSON conversion versus plugin-owned validation; separate paragraphs, member spacing and a blank line before tags follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Transform accepts package specifiers and native paths with explicit declaration or consumer bases; conventional configFile uses the selected plugin-config anchor. Native resolution belongs to the loader, without requiring one separator spelling in this config type.
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
   * For tsconfig/jsconfig entries, relative paths resolve from the config file
   * that declared the entry, while package specifiers resolve from the
   * consuming project root. A caller-supplied replacement list uses that
   * project root for both forms.
   *
   * For automatically discovered package markers, relative paths resolve from
   * the publishing package. Package specifiers resolve from the consuming
   * project's package directory.
   *
   * The loaded JavaScript module must export an {@link ITtscPlugin} descriptor
   * or descriptor factory. The Go implementation itself is declared by the
   * descriptor's {@link ITtscPlugin.source} field.
   */
  transform?: string;

  /**
   * Plugin-specific configuration carried in the native manifest's JSON
   * payload.
   *
   * Plugin packages should document and validate their options in the factory
   * or Go source. Ttsc requires serializable programmatic input and observes
   * the conventional `configFile` input, but does not validate plugin-owned
   * meaning.
   */
  [key: string]: unknown;
}
