/**
 * The source a development session hands Turbopack for a module whose compile
 * failed: evaluation throws an Error with the compile's message. The loader can
 * complete successfully with this source after reporting its diagnostic
 * (samchon/ttsc#1458); worker retention and page presentation remain
 * host-owned.
 *
 * The message is embedded as a JSON string, so nothing in a diagnostic can
 * escape the literal on the supported JavaScript runtime. It fabricates no
 * exports. A host that rejects an import during linking can report that error
 * before evaluation; this helper guarantees the diagnostic when evaluated, not
 * every importer's error presentation.
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
 *   Native paragraphs explain evaluation, host-owned delivery and literal safety,
 *   with description/tag separation following documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   JSON encoding scans message text and allocates its escaped representation;
 *   concatenation adds fixed throw syntax. Time and returned/temporary string
 *   space follow message and escaped bytes, not this helper's statement count.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function failedModuleSource(failure: Error): string {
  return `throw new Error(${JSON.stringify(failure.message)});\n`;
}
