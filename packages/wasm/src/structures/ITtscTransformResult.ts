import type { ITtscDiagnostic } from "./ITtscDiagnostic";

/**
 * Structured payload inside `ITtscResult.result` for `transform`.
 *
 * `typescript` maps source paths to post-transform TypeScript text for a preview
 * before emit. Paths inside `cwd` are relative; outside sources remain absolute.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A path-keyed string record matches the native transform payload, keeping
 *   transformed TypeScript distinct from build's emitted JavaScript map.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A source-text map and the shared diagnostic DTO serve transform consumers;
 *   emitted files belong to the compile result instead of a mixed payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The payload exposes actual transformed source, without treating expected
 *   emitted answers as a replacement for the transform result.
 * @evidence contracts/common.md#meaningful-documentation
 *   Separate paragraphs identify the envelope and source stage; members explain
 *   optional diagnostics, following the documentation skill's clarity guidance.
 */
export interface ITtscTransformResult {
  /** Present when the native transform includes diagnostic messages. */
  diagnostics?: ITtscDiagnostic[];

  /** Post-transform source text keyed by source-file paths. */
  typescript: Record<string, string>;
}
