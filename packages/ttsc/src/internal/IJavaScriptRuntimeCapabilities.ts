/**
 * What a JavaScript runtime executable can do, as measured by running it.
 *
 * Produced by {@link javascriptRuntimeCapabilities}, which asks the interpreter
 * itself rather than inferring from the host process: a `node` found on `PATH`,
 * a version-manager shim, and Bun can all stand in for the runtime a plugin
 * descriptor is evaluated with, and each supports a different loader.
 *
 * False flags also describe unsuccessful or malformed probes; the shape does
 * not distinguish inability to observe a feature from observed unavailability.
 * The optional executable is absent unless the probe returned an absolute
 * path.
 *
 * @evidence contracts/common.md#principled-implementation Independent Bun and synchronous-hook flags represent measured runtime capabilities rather than assuming the host's runtime; an optional executable preserves unknown interpreter identity and false conservatively includes unsuccessful observation.
 * @evidence contracts/common.md#clear-and-simple-design One small result separates loader family, hook capability and executable identity without embedding probe process state or feature-detection policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The producer asks the interpreter for real features and rejects malformed results; runtime names or host version numbers do not manufacture support flags in this representation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain measured origin, wrapper identity, failure/false ambiguity and executable absence; member comments describe loader consequences with documentation-skill member and tag separation.
 * @evidence contracts/portability.md#os-neutral-implementation Actual interpreter capabilities and its native absolute executable path cross the process boundary explicitly; the type does not infer feature availability from operating-system names or path extensions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type IJavaScriptRuntimeCapabilities = {
  /**
   * The executable is Bun. Bun loads TypeScript descriptors natively, and the
   * descriptor evaluator isolates it from Bun's own config, `.env` loading, and
   * network auto-install. The ttsx runtime-hook preload is gated separately, on
   * the measured {@link registerHooks}, so Bun receives it only if it ever
   * reports that hook.
   */
  bun: boolean;

  /**
   * The absolute path the runtime reports as its own `process.execPath`, when
   * the probe could read one. A wrapper script and its real binary answer
   * differently here, which is how the evaluator reaches the physical
   * interpreter instead of a mutable shim.
   */
  executable?: string;

  /**
   * `module.registerHooks` exists (Node 22.15 and later), so the ttsx
   * synchronous runtime hooks can be installed in that process.
   */
  registerHooks: boolean;
};
