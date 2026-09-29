/**
 * What a `module.registerHooks` resolve hook returns, as ttsx's hooks use it.
 *
 * Declared here because Node's own typings do not export the synchronous hook
 * shapes.
 *
 * @evidence contracts/common.md#principled-implementation URL, nullable format hint and optional shortCircuit represent the synchronous resolver's supported result distinctions without treating absent format as a guessed loader kind.
 * @evidence contracts/common.md#clear-and-simple-design One local structural interface carries only the hook fields consumed here because Node's typings do not export the synchronous shape.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This declaration represents the public hook boundary rather than exposing or replacing Node loader internals.
 * @evidence contracts/common.md#meaningful-documentation Native purpose and typing rationale accompany separate member comments for URL representation, format deferral and chain termination.
 * @evidence contracts/portability.md#os-neutral-implementation The result uses module URL spelling rather than native path syntax; file URL conversion is owned by hook producers so drive letters and separators are not guessed here.
 */
export interface ResolveResult {
  /** The resolved module URL; a `file:` URL for anything ttsx serves. */
  url: string;

  /** Format hint for the load hook; `null` or absent lets the load decide. */
  format?: string | null;

  /** End the hook chain here instead of calling the next resolver. */
  shortCircuit?: boolean;
}
