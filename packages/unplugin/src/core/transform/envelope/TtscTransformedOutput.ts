import type { ITtscCompilerTransformation } from "ttsc";

/**
 * One module's entry in a transform envelope: its transformed text and, when
 * the host supplied one, the source map from that text back to the text it was
 * transformed from (samchon/ttsc#1392).
 *
 * @evidence contracts/common.md#principled-implementation Required text and an optional same-entry source map preserve the distinction between transformed code and available provenance; this container does not manufacture a map when the producer omitted it.
 * @evidence contracts/common.md#clear-and-simple-design The two fields carry one module's transform artifact without embedding compiler diagnostics or watch state in a bundler result.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An absent map stays undefined; the shape contains no consumer-specific synthetic mapping or foreign mutation.
 * @evidence contracts/common.md#meaningful-documentation The native description states mapping direction and member comments explain map origin, relative sources and absence; members and acknowledgment prose follow the documentation skill's spacing guidance.
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
