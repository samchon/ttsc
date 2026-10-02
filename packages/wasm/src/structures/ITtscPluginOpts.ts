/**
 * Options for dispatching a named plugin subcommand via `api.plugin`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Required dispatch fields plus scalar options mirror buildPluginArgv's native
 *   translation, allowing each registered plugin to own its argument schema.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Named dispatch fields are separated from forwarded scalars; the index
 *   signature permits plugin-owned arguments without hardwiring plugin schemas.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Plugin defaults remain with the plugin; this transport does not hardcode
 *   consumer-specific arguments or pretend to validate an unknown command.
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc distinguishes dispatch identity from forwarded arguments and
 *   boolean omission, following the documentation skill's usage-context guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscPluginOpts is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscPluginOpts is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscPluginOpts is a data interface and coordinates no shared or repeated computation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscPluginOpts is a data interface and performs no native filesystem, path or process operation.
 */
export interface ITtscPluginOpts {
  /** Plugin id registered with `host.Expose` (e.g. `@ttsc/banner`). */
  name: string;

  /** Subcommand the plugin's Run will receive (e.g. `build`). */
  command: string;

  /** Forwarded as `--cwd=<value>`. */
  cwd?: string;

  /** Forwarded as `--tsconfig=<value>`; an absent value is left to the plugin. */
  tsconfig?: string;

  /** Scalars become `--key=value`; true becomes `--key`, false/undefined are omitted. */
  [key: string]: string | boolean | number | undefined;
}
