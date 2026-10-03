/**
 * Pipeline stage where a plugin's lazily built Go source participates.
 *
 * - `"transform"`: participates in the TypeScript-Go transform path. Transform
 *   plugins do not receive emitted JavaScript or emitted file text.
 * - `"check"`: runs before emit and reports diagnostics. Use this for lint or
 *   validation plugins that should fail the compile before JavaScript or
 *   declaration output is generated. Check plugins may also implement `fix` and
 *   `format` commands, which `ttsc fix` / `ttsc format` invoke with emit
 *   disabled.
 *
 * @evidence contracts/common.md#principled-implementation The two literal stages preserve the host distinction between source transformation and pre-emit diagnostics; they do not imply access to emitted artifacts.
 * @evidence contracts/common.md#clear-and-simple-design A literal union names the two supported pipeline positions without adding independent mode flags.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Both discriminants are protocol values, not plugin-name exceptions or fixture-specific stages.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc describes timing, available text and fix/format behavior in separate prose and list entries; a blank comment line separates these facts from acknowledgments, following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type TtscPluginStage = "transform" | "check";
