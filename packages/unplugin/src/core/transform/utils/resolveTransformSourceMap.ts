import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";

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
 *
 * @evidence contracts/common.md#principled-implementation
 *   Relative sources resolve from the emitted module and sourceRoot; filesystem
 *   identity finds the map's actual module before sourcesContent is compared.
 *   A missing or different content witness cannot justify composing this map.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One boundary validates provenance and converts path spelling for bundlers;
 *   filesystem equivalence stays with the shared transaction resolver.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Module matching uses physical file identity instead of an OS-wide lowercase
 *   assumption; unverifiable maps are omitted without fabricated source entries.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain source-content provenance, absolute source spelling
 *   and absence effects; prose and tags follow documentation guidance.
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
  const identities = createHostPathIdentityContext();
  const module = pathIdentityKey(file, identities);
  const own = sources.findIndex(
    (entry) => pathIdentityKey(entry, identities) === module,
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
