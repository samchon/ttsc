import type { RuntimeManifest } from "./RuntimeManifest";

/**
 * The served source of each entry module a checked entry build emitted,
 * prepared once.
 *
 * A checked entry build's emit is immutable for the run: ttsx prepares it
 * before the program starts, and a root `ttsc/register` prepares stays
 * registered (`RuntimeManifestRegistry`). Node 22.15 nevertheless calls the
 * `load` hook twice for the process entry, and each call read and source-mapped
 * the same emitted file again (samchon/ttsc#1749). A repeated entry load of one
 * build's emitted file is answered from its first preparation. A module served
 * by any other lane, a project build or an isolated emit of a file the program
 * may rewrite, is prepared on every load as before, and so is a non-entry
 * module, whose text Node already holds.
 *
 * @evidence contracts/common.md#principled-implementation Only an entry module's emitted file of a registered checked build, the registry's immutable premise, is remembered, keyed by that build, so a reused answer is the answer a repeated read would give.
 * @evidence contracts/common.md#clear-and-simple-design One map per build and one accessor; the caller supplies the preparation it already performs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Nothing about Node's loader is patched; the hook still answers every call Node makes, and lanes whose source can change are never remembered.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the repeated call, the immutable entry emit and the lanes left unaffected.
 * @evidence contracts/portability.md#os-neutral-implementation Files are keyed by the emitted path the build's ownership index returned, under the build object that owns it.
 * @evidence contracts/performance.md#efficient-algorithms One WeakMap and one map lookup per serve.
 * @evidence contracts/performance.md#reuse-equivalent-work A repeated entry load of an entry build's emitted file reuses the first preparation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One served source per entry module, held while the registry keeps its build; a run has one entry and a handful of JavaScript-to-TypeScript boundaries.
 */
export namespace RuntimeEntrySources {
  /**
   * The served source of entry module `emittedFile` from checked entry build
   * `manifest`, prepared by `prepare` on its first serve only.
   *
   * @evidence contracts/common.md#principled-implementation Only an entry load of a registered checked build's emitted file asks; that emit is immutable for the run, so the first preparation is the answer a repeated one would give.
   * @evidence contracts/common.md#clear-and-simple-design One lookup or one preparation and insertion.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller's own preparation runs unchanged on the first serve.
   * @evidence contracts/common.md#meaningful-documentation Native prose states which serve prepares.
   * @evidence contracts/portability.md#os-neutral-implementation Files are keyed by the emitted path the ownership index returned.
   * @evidence contracts/performance.md#efficient-algorithms One WeakMap and one map lookup, and on the first serve one insertion.
   * @evidence contracts/performance.md#reuse-equivalent-work A repeated serve returns the first preparation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One source per entry module is retained while its build is.
   */
  export function serve<Source>(
    manifest: RuntimeManifest,
    emittedFile: string,
    prepare: () => Source,
  ): Source {
    let files = served.get(manifest);
    if (files === undefined) {
      files = new Map();
      served.set(manifest, files);
    }
    if (files.has(emittedFile)) return files.get(emittedFile) as Source;
    const source = prepare();
    files.set(emittedFile, source);
    return source;
  }
}

const served = new WeakMap<RuntimeManifest, Map<string, unknown>>();
