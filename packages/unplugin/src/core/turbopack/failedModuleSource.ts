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
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function failedModuleSource(failure: Error): string {
  return `throw new Error(${JSON.stringify(failure.message)});\n`;
}
