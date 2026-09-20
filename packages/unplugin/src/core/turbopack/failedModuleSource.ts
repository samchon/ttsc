/**
 * The source a development session hands Turbopack for a module whose compile
 * failed: one that throws the failure when evaluated, so the page fails with
 * the compile's own message while the loader run itself succeeds and Turbopack
 * keeps its worker (samchon/ttsc#1458).
 *
 * The message is embedded as a JSON string, so nothing in a diagnostic can
 * escape the literal, and the module exports nothing: an importer that reaches
 * it evaluates it first and throws before any binding is read.
 */
export function failedModuleSource(failure: Error): string {
  return `throw new Error(${JSON.stringify(failure.message)});\n`;
}
