/**
 * The runner command identity used to select its accepted flag rows.
 *
 * @evidence contracts/common.md#principled-implementation The sole literal matches the current runner dispatcher and keeps runner-only flags distinct from compiler commands.
 * @evidence contracts/common.md#clear-and-simple-design The alias supplies the identity required by the shared flag schema without implementing speculative runner subcommands.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed ttsx spelling is the public command contract used by the parser's callers.
 * @evidence contracts/common.md#meaningful-documentation The comment states the identity's selection role instead of promising future features, following the documentation skill's direct purpose-oriented prose.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type TtsxSubcommand = "ttsx";
