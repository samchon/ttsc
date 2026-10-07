/**
 * What a `module.registerHooks` resolve hook returns, as ttsx's hooks use it.
 *
 * This local structural view names the result fields consumed by ttsx; it is a
 * subset of Node's current ResolveFnOutput rather than a claim that Node has no
 * synchronous hook typings.
 *
 * @evidence contracts/common.md#principled-implementation URL, nullable format hint and optional shortCircuit represent the synchronous resolver's supported result distinctions without treating absent format as a guessed loader kind.
 * @evidence contracts/common.md#clear-and-simple-design One local structural interface names the consumed URL, format and chain-control fields; Node's ResolveFnOutput also carries import attributes that this view does not describe or remove.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This declaration represents the public hook boundary rather than exposing or replacing Node loader internals.
 * @evidence contracts/common.md#meaningful-documentation Native purpose and typing rationale accompany separate member comments for URL representation, format deferral and chain termination.
 * @evidence contracts/portability.md#os-neutral-implementation The result uses module URL spelling rather than native path syntax; file URL conversion is owned by hook producers so drive letters and separators are not guessed here.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface ResolveResult {
  /** The resolved module's URL/protocol spelling, not a native filename. */
  url: string;

  /** Format hint for the load hook; `null` or absent lets the load decide. */
  format?: string | null;

  /** When true, end the hook chain here instead of calling the next resolver. */
  shortCircuit?: boolean;
}
