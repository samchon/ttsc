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
 * and when the text arriving here is the text the map was made for, so a map
 * never describes other text. Everything else passes through untouched.
 *
 * @param content Module text the previous loader produced.
 * @param map Source map the previous loader produced, if any.
 * @param meta Metadata the previous loader produced, handed on as is.
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
