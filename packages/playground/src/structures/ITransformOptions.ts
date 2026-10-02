/**
 * Toggle flags the UI surfaces in the Options panel and forwards to the worker
 * on every compile. The built-in `typia` and `lint` keys mirror the two plugin
 * verbs `createWorkerCompiler` calls by default; sites that wire additional
 * plugins can extend this interface via TypeScript declaration merging or pass
 * a richer shape through `[key: string]: boolean | undefined`.
 *
 * @evidence contracts/common.md#principled-implementation Optional boolean flags distinguish default integration behavior from explicit disabling; the index signature permits additional boolean site flags.
 * @evidence contracts/common.md#clear-and-simple-design Per-call flags stay independent of factory plugin registration and UI labels.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Extensible keys pass through the declared option boundary instead of adding site-specific dispatcher branches.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains extension, default enablement and forwarding, with documentation-skill paragraphs and member spacing.
 */
export interface ITransformOptions {
  /** Enable the typia transform plugin. Defaults to true. */
  typia?: boolean;

  /** Enable the `@ttsc/lint` preview rule pass. Defaults to true. */
  lint?: boolean;

  /** Additional site-specific toggles. */
  [key: string]: boolean | undefined;
}
