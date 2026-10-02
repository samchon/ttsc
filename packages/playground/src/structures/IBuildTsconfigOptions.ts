/**
 * Options accepted by {@link buildTsconfigJSON}; extra compiler entries override
 * the module and directory defaults during serialization.
 *
 * @evidence contracts/common.md#principled-implementation Required module spelling and optional JSON-compatible overrides express the emitted compiler configuration, not compiler validation.
 * @evidence contracts/common.md#clear-and-simple-design A flat options record separates compiler entries from project include globs without another configuration layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Literal module choices are supported compiler settings; callers supply extensions through compilerOptions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states override precedence, directory defaults and emit purpose; paragraphs and member spacing follow the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export interface IBuildTsconfigOptions {
  /**
   * Module emit shape. Sites preview-render ESM, then re-run as CommonJS for
   * the in-page `new Function` sandbox.
   */
  module: "ESNext" | "CommonJS";

  /** Output directory relative to project root. Defaults to `"dist"`. */
  outDir?: string;

  /** Source root relative to project root. Defaults to `"src"`. */
  rootDir?: string;

  /**
   * Extra entries spliced into `compilerOptions`. Use for plugins, paths, lib
   * overrides, etc.
   */
  compilerOptions?: Record<string, unknown>;

  /** Project `include` globs. Defaults to `["src"]`. */
  include?: readonly string[];
}
