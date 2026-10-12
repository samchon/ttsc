/**
 * The source served for each entry module of this run, prepared once.
 *
 * An entry's emit belongs to the run: ttsx prepares it before the program
 * starts, and a root `ttsc/register` prepares stays registered for the run.
 * Node 22.15 nevertheless calls the `load` hook twice for the process entry,
 * and each call resolved, read and source-mapped the same emit again
 * (samchon/ttsc#1749). A repeated load of the same entry URL is answered from
 * its first preparation. Every other module is served as before.
 *
 * @evidence contracts/common.md#principled-implementation Only entry URLs, whose emit is fixed for the run, are remembered, so a reused answer is the answer a repeated preparation would give.
 * @evidence contracts/common.md#clear-and-simple-design One map and one accessor; the caller supplies the preparation it already performs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Nothing about Node's loader is patched; the hook still answers every call Node makes.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the repeated call, the run-scoped emit and the unaffected modules.
 * @evidence contracts/portability.md#os-neutral-implementation Entries are keyed by the URL Node passes, the identity it uses for the module.
 * @evidence contracts/performance.md#efficient-algorithms One map lookup per entry load.
 * @evidence contracts/performance.md#reuse-equivalent-work A repeated entry load reuses the first preparation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One served source per entry URL of the process, released with the process; a run has one entry and a handful of JavaScript-to-TypeScript boundaries.
 */
export namespace RuntimeEntrySources {
  /**
   * The served source of entry `url`, prepared by `prepare` on its first load
   * only.
   */
  export function serve<Source>(url: string, prepare: () => Source): Source {
    if (served.has(url)) return served.get(url) as Source;
    const source = prepare();
    served.set(url, source);
    return source;
  }
}

const served = new Map<string, unknown>();
