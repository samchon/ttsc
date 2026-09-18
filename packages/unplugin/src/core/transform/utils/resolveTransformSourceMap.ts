import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

/**
 * The source map a bundler receives for one transformed module, or `undefined`
 * when the envelope's map cannot be trusted to describe the delivered text
 * (samchon/ttsc#1392).
 *
 * A map describes the text it was generated from, and the bundler composes it
 * with the map of the text it delivered. The two are the same text only when
 * the generation compiled the module from exactly the bytes the bundler holds.
 * A delivery that diverged from the disk, such as the output of an earlier
 * plugin that the generation still accepted (samchon/ttsc#1394), would compose
 * into a map that points at the wrong lines. So the map is kept only when its
 * `sourcesContent` entry for the module equals the delivered source. A map
 * without that entry cannot be checked and is dropped too.
 *
 * `sources` become absolute, forward-slash paths. Each bundler resolves a
 * relative source against something different: Rollup and Vite against the
 * module's directory, webpack against the compiler context. An absolute source
 * names the same file for all of them, and a forward slash is valid in a path
 * on every platform, whereas a backslash is not a URL separator.
 *
 * @param file Absolute path of the transformed module.
 * @param source Text the bundler delivered for the module.
 * @param map The envelope's map for the module.
 * @returns The map to hand the bundler, or `undefined` to hand it none.
 */
export function resolveTransformSourceMap(
  file: string,
  source: string,
  map: ITtscCompilerTransformation.ISourceMap,
): ITtscCompilerTransformation.ISourceMap | undefined {
  const directory = path.dirname(file);
  const sources = map.sources.map((entry) =>
    path.resolve(directory, map.sourceRoot ?? "", entry).replace(/\\/g, "/"),
  );
  const module = path.resolve(file).replace(/\\/g, "/");
  const own = sources.findIndex((entry) =>
    process.platform === "win32"
      ? entry.toLowerCase() === module.toLowerCase()
      : entry === module,
  );
  if (own < 0 || map.sourcesContent?.[own] !== source) {
    return undefined;
  }
  return {
    file: path.basename(file),
    mappings: map.mappings,
    names: map.names,
    sources,
    sourcesContent: map.sourcesContent,
    version: 3,
  };
}
