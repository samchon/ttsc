/**
 * The source a development session hands Turbopack for a module whose compile
 * failed: one that throws the failure when evaluated, so the page fails with
 * the compile's own message while the loader run itself succeeds and Turbopack
 * keeps its worker (samchon/ttsc#1458).
 *
 * The message is embedded as a JSON string, so nothing in a diagnostic can
 * escape the literal, and the module exports nothing: an importer that reaches
 * it evaluates it first and throws before any binding is read.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A top-level throw preserves a compiler verdict when evaluated; JSON string
 *   encoding prevents diagnostic text from becoming executable source syntax.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One helper owns diagnostic-to-failed-module representation separately from
 *   the loader's choice between verdict delivery and infrastructure failure.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The generated throw communicates the real compile failure; it does not
 *   fabricate working exports to bypass an unsuccessful compilation.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain retained worker behavior and literal safety,
 *   with description/tag separation following documentation guidance.
 */
export function failedModuleSource(failure: Error): string {
  return `throw new Error(${JSON.stringify(failure.message)});\n`;
}
