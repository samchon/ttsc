import type { ITtscCompilerTransformation } from "ttsc";

/**
 * One module's entry in a transform envelope: its transformed text and, when
 * the host supplied one, the source map from that text back to the text it was
 * transformed from (samchon/ttsc#1392).
 */
export interface TtscTransformedOutput {
  /** Transformed TypeScript text of the module. */
  code: string;

  /**
   * The envelope's source map for the module, as the host wrote it: `sources`
   * relative to the module's directory. `undefined` when the host supplied
   * none.
   */
  map?: ITtscCompilerTransformation.ISourceMap;
}
