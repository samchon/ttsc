import { TTSC_SOURCE_MAP_STASH } from "./TTSC_SOURCE_MAP_STASH";

/**
 * Webpack and Rspack loader that hands the ttsc transform's source map on to
 * the next loader (samchon/ttsc#1392).
 *
 * Unplugin's transform loader passes a transform's map on only when the module
 * arrived with one. The ttsc loader runs first, on the file's own text, so no
 * map ever arrived, and every later loader and the bundle's map described the
 * transformed text instead of the author's. The transform leaves its result
 * under {@link TTSC_SOURCE_MAP_STASH}, and this loader, which runs right after
 * it, passes that map on in place of the missing one.
 *
 * The map is passed on only when the host asked for maps, when no map arrived,
 * and when the arriving string equals the stashed transformed string. This
 * associates the owned map with its recorded text; it does not validate an
 * incoming host map. Other content, maps and metadata pass through untouched.
 *
 * @param content Module text the previous loader produced.
 * @param map Source map the previous loader produced, if any.
 * @param meta Metadata the previous loader produced, handed on as is.
 *
 * @evidence contracts/common.md#principled-implementation Restoration requires the requesting loader context, missing incoming map, and exact transformed text; an unrelated map or changed content retains the host's result.
 * @evidence contracts/common.md#clear-and-simple-design A single callback forwards content and metadata unchanged while choosing the one map this adapter owns.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The private WeakMap hands off owned transform output without replacing host methods or manufacturing a map to satisfy a test.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies the upstream map loss and every restoration condition; the callback receiver and pass-through parameters remain explicit.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One WeakMap lookup/delete precedes fixed guards and strict string equality,
 *   whose comparison can follow content length. No content/map copy is made;
 *   the host callback's own work is additional.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Reuses the producer's result across the transform/restoration phases only
 *   for the same loader context, requested maps, absent incoming map and exact
 *   stashed code. A different text/context cannot authorize that handoff.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Deletes this context's entry before any guard or callback, including a
 *   rejected map or throwing callback. Content/map/meta transfer unchanged to
 *   the host; unconsumed context retention belongs to the WeakMap producer.
 */
export function restoreTtscSourceMap(
  this: {
    callback(
      error: null,
      content: string | Buffer,
      map?: unknown,
      meta?: unknown,
    ): void;
    sourceMap?: boolean;
  },
  content: string | Buffer,
  map?: unknown,
  meta?: unknown,
): void {
  const stash = TTSC_SOURCE_MAP_STASH.get(this);
  TTSC_SOURCE_MAP_STASH.delete(this);
  this.callback(
    null,
    content,
    this.sourceMap === true &&
      (map === undefined || map === null) &&
      stash?.map !== undefined &&
      content === stash.code
      ? stash.map
      : map,
    meta,
  );
}
