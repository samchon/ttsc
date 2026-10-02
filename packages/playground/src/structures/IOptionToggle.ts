/**
 * Toggle metadata the OptionsPanel renders.
 *
 * Sites declare these for whatever transform plugins their wasm registered; the
 * panel renders one row per entry and bubbles `onChange` with the merged
 * options object.
 *
 * @evidence contracts/common.md#principled-implementation The key identifies a boolean option while label and description supply its visible presentation.
 * @evidence contracts/common.md#clear-and-simple-design Rendering metadata stays separate from plugin execution and current option values.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Site-provided keys drive the panel instead of consumer-specific option branches.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains site ownership and option merging in separated paragraphs following the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export interface IOptionToggle {
  key: string;
  label: string;
  description: string;
}
