/**
 * What a `module.registerHooks` resolve hook returns, as ttsx's hooks use it.
 *
 * Declared here because Node's own typings do not export the synchronous hook
 * shapes.
 */
export interface ResolveResult {
  /** The resolved module URL; a `file:` URL for anything ttsx serves. */
  url: string;
  /** Format hint for the load hook; `null` or absent lets the load decide. */
  format?: string | null;
  /** End the hook chain here instead of calling the next resolver. */
  shortCircuit?: boolean;
}
