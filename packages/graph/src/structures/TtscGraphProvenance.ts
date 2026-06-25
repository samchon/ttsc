/**
 * How a node or edge was derived — the trust signal that keeps inferred
 * relationships from being read as compiler fact.
 *
 * - `checker-resolved`: the in-process TypeScript-Go checker resolved the symbol
 *   on both ends. This is the graph's core guarantee and the reason it is not a
 *   tree-sitter or text index.
 * - `framework-derived`: derived from a framework convention rather than a
 *   checker symbol resolution (e.g. a route from a decorator, a file-path
 *   convention). The engine never emits this; it is reserved for an inference
 *   layer a consumer builds on top of the graph.
 * - `heuristic`: a best-effort inference (a callback or event bridge). Also never
 *   emitted by the engine; reserved for a consumer layer and, when present,
 *   always visibly marked and excluded from a default trace.
 */
export type TtscGraphProvenance =
  | "checker-resolved"
  | "framework-derived"
  | "heuristic";
