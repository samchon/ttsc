/**
 * Toggle flags the UI surfaces in the Options panel and forwards to the worker
 * on every compile. The built-in `typia` and `lint` keys mirror the two plugin
 * verbs `createWorkerCompiler` calls by default; sites that wire additional
 * plugins can extend this interface via TypeScript declaration merging or pass
 * a richer shape through `[key: string]: boolean | undefined`.
 */
export interface ITransformOptions {
  /** Enable the typia transform plugin. Defaults to true. */
  typia?: boolean;
  /** Enable the `@ttsc/lint` preview rule pass. Defaults to true. */
  lint?: boolean;
  /** Additional site-specific toggles. */
  [key: string]: boolean | undefined;
}
