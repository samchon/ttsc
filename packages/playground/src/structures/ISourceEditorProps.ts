/**
 * Props for the Monaco-based source editor. The site provides `extraLibs` —
 * typically the typia `.d.ts` pack and any installed npm package `.d.ts` files
 * — and the editor mounts them via
 * `monaco.languages.typescript.typescriptDefaults.addExtraLib`.
 *
 * @evidence contracts/common.md#principled-implementation Controlled text, change callback, model URI and optional declaration map describe Monaco's input boundaries.
 * @evidence contracts/common.md#clear-and-simple-design Editor props contain editing and virtual-library inputs without compiler lifecycle state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Declaration installation uses Monaco's supported extra-lib API rather than mutating editor internals.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains map identity replacement and default URI, with separated paragraphs and member spacing under the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export interface ISourceEditorProps {
  value: string;

  /**
   * Publish the editor's complete current text to the controlling owner.
   */
  onChange: SourceEditorChangeHandler;

  /**
   * Map of file path → declaration text. Mounted into Monaco's TypeScript
   * extra-libs registry. Hot-replaceable: the editor disposes the previous libs
   * and re-mounts when the map identity changes.
   */
  extraLibs?: Record<string, string>;

  /** Editor model URI. Defaults to `file:///src/playground.ts`. */
  path?: string;
}

/**
 * Publish the editor's complete text to its controlling owner.
 *
 * @evidence contracts/common.md#principled-implementation The full-text parameter matches the controlled value model without requiring edit-delta reconstruction.
 * @evidence contracts/common.md#clear-and-simple-design One void notification leaves text state with the parent.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The supported event boundary avoids mutating parent state or editor globals.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the payload and owner, separated from the acknowledgment tags.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export type SourceEditorChangeHandler = (value: string) => void;
