import { tokTypes, tokenizer } from "acorn";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Rewrite a recognized trailing source-map line comment to inline metadata,
 * anchoring native source paths to file URLs while preserving qualified URLs.
 * A supplied single-source anchor overrides its map entry; this is lexical
 * attribution rather than a check that the referenced source exists.
 *
 * Ttsx runs tsgo-built JavaScript under the ORIGINAL `.ts` source URL. When the
 * owning tsconfig emits external maps, their relative URL belongs to the emit
 * directory rather than the served source URL. Reading and embedding metadata
 * avoids that relative lookup after temporary emits are removed. Actual Node,
 * coverage-tool, debugger and editor interpretation remains their boundary.
 *
 * Re-inlining supported normalized string-source maps under the same source
 * anchor preserves the rewritten bytes. This adapter does not validate every
 * source-map semantic shape or authenticate a cross-process cache population.
 *
 * Reuse requires unchanged served text, source anchor and actual map bytes. The
 * module cache retains at most 128 recent entries; individual map sizes are not
 * capped. Only actual trailing line comments are rewritten. Strings, templates
 * and regular-expression contents cannot supply a directive; unsupported
 * lexical input is left for the runtime loader to diagnose.
 *
 * @param source - The emitted JavaScript text served under the source URL.
 * @param emittedFile - On-disk path of the emitted `.js`, beside its `.map`.
 * @param sourceFile - Real path of the `.ts` source the emit was built from.
 *
 * @evidence contracts/common.md#principled-implementation Acorn comment boundaries distinguish a real trailing directive from literal contents. Metadata uses supplied lexical anchors; parse failures, non-object maps, invalid index sections and unsupported lexical input retain the source. This is not complete source-map schema validation.
 * @evidence contracts/common.md#clear-and-simple-design The serve boundary coordinates input-equivalent reuse, while helpers separate URL decoding, file reading and source anchoring; external map validity is checked before returning cached JavaScript.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Canonical sibling-map fallback follows compiler emit layout and missing-map removal addresses a dangling reference; no cached filename alone substitutes for current source or map contents.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain source-URL execution, idempotence, cache equivalence and retention limits; parameters distinguish emitted and original-source paths.
 * @evidence contracts/portability.md#os-neutral-implementation Node path resolution reads native emitted files and pathToFileURL encodes source paths; already-qualified map URLs remain protocol identifiers rather than being case-folded as filesystem paths.
 * @evidence contracts/performance.md#efficient-algorithms Work includes regex matching, optional full-source Acorn lexing, native map reads, JSON/base64 conversion and recursive section/source normalization with path-text costs. No universal linear-time or depth bound is asserted. An equal-source entry at the same emitted key reuses lexical recognition; a fully matching entry avoids rewrite processing after current map-data validation.
 * @evidence contracts/performance.md#reuse-equivalent-work Absolute native locations capture cwd-sensitive emitted/source anchors, while exact source text shares lexical recognition and freshly read map JSON validates the rewrite; changed bytes or anchors rebuild rather than serving an old generation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The module owns a 128-entry insertion-ordered LRU and evicts its oldest entry after a miss; retained bytes still depend on individual source/map sizes, and process exit releases the remaining cache.
 */
export function inlineServedSourceMap(
  source: string,
  emittedFile: string | undefined,
  sourceFile: string | undefined,
): string {
  if (emittedFile === undefined) {
    return source;
  }
  const emittedPath = path.resolve(emittedFile);
  const sourcePath =
    sourceFile === undefined ? undefined : path.resolve(sourceFile);
  const cached = inlineCache.get(emittedPath);
  const match =
    cached?.source === source ? cached.match : trailingSourceMapComment(source);
  const url = match?.[1]?.trim();
  const json = url ? readMapJson(url, emittedPath) : null;
  if (
    cached !== undefined &&
    cached.source === source &&
    cached.sourceFile === sourcePath &&
    cached.json === json
  ) {
    inlineCache.delete(emittedPath);
    inlineCache.set(emittedPath, cached);
    return cached.rewritten;
  }
  const rewritten = rewrite(source, emittedPath, sourcePath, match, json);
  inlineCache.delete(emittedPath);
  inlineCache.set(emittedPath, {
    source,
    sourceFile: sourcePath,
    match,
    json,
    rewritten,
  });
  if (inlineCache.size > 128) {
    inlineCache.delete(inlineCache.keys().next().value!);
  }
  return rewritten;
}

/** Most recently used rewrites; map bytes are re-read before sharing a result. */
const inlineCache = new Map<
  string,
  {
    source: string;
    sourceFile: string | undefined;
    match: RegExpExecArray | null;
    json: string | null;
    rewritten: string;
  }
>();

/**
 * Trailing `//# sourceMappingURL=<url>` (or legacy `//@`) magic comment.
 * Anchored at end of text through any trailing whitespace, so it matches the
 * last comment whether tsgo emitted it with a newline, none, or a CRLF line
 * ending.
 */
const SOURCE_MAPPING_URL = /\/\/[#@] sourceMappingURL=([^\r\n]*)[ \t\r\n]*$/;

/**
 * Locate a real trailing line comment without treating string/regex text as
 * code.
 */
function trailingSourceMapComment(source: string): RegExpExecArray | null {
  const candidate = SOURCE_MAPPING_URL.exec(source);
  if (candidate === null) return null;
  let recognized = false;
  try {
    const lexer = tokenizer(source, {
      ecmaVersion: "latest",
      sourceType: "module",
      onComment(block, _text, start) {
        if (!block && start === candidate.index) recognized = true;
      },
    });
    while (lexer.getToken().type !== tokTypes.eof) {
      // Lexing supplies comment boundaries without allocating an AST.
    }
  } catch {
    // Optional mapping cannot replace the actual loader's syntax diagnostics.
    return null;
  }
  return recognized ? candidate : null;
}
function rewrite(
  source: string,
  emittedFile: string,
  sourceFile: string | undefined,
  match: RegExpExecArray | null,
  json: string | null,
): string {
  if (match === null) {
    return source;
  }
  const url = match[1]!.trim();
  if (url.length === 0) {
    return source;
  }
  if (json === null) {
    // The referenced map cannot be read (an external ref whose sibling is
    // missing). Strip the dangling comment so Node does not cache the script
    // with `data: null` and misattribute coverage; leave an already-inline
    // `data:` map untouched since it is self-contained.
    return url.startsWith("data:")
      ? source
      : source.slice(0, match.index).replace(/\r?\n$/, "");
  }
  const inlined = inlineComment(json, emittedFile, sourceFile);
  if (inlined === null) {
    return source;
  }
  return source.slice(0, match.index) + inlined;
}

/** Read the raw map JSON from a `data:` URI or a sibling map file. */
function readMapJson(url: string, emittedFile: string): string | null {
  if (url.startsWith("data:")) {
    return decodeDataUri(url);
  }
  const direct = path.resolve(path.dirname(emittedFile), url);
  const fromRef = readFileOrNull(direct);
  if (fromRef !== null) {
    return fromRef;
  }
  // tsgo names the comment after the emit basename; fall back to the canonical
  // sibling path when the comment's relative form does not resolve on disk.
  return readFileOrNull(`${emittedFile}.map`);
}

/** Decode a `data:application/json[;base64],...` source-map URI to its JSON. */
function decodeDataUri(url: string): string | null {
  const comma = url.indexOf(",");
  if (comma === -1) {
    return null;
  }
  const meta = url.slice(0, comma);
  if (!meta.includes("application/json")) {
    return null;
  }
  const payload = url.slice(comma + 1);
  try {
    return meta.includes(";base64")
      ? Buffer.from(payload, "base64").toString("utf8")
      : decodeURIComponent(payload);
  } catch {
    return null;
  }
}

/** Parse the map, absolutize its `sources`, and re-encode it as a `data:` URI. */
function inlineComment(
  json: string,
  emittedFile: string,
  sourceFile: string | undefined,
): string | null {
  let map: {
    sources?: unknown;
    sourceRoot?: unknown;
    [key: string]: unknown;
  };
  try {
    map = JSON.parse(json) as typeof map;
  } catch {
    return null;
  }
  if (map === null || typeof map !== "object" || Array.isArray(map)) {
    return null;
  }
  try {
    absolutizeMap(map, path.dirname(emittedFile), sourceFile);
  } catch {
    // A URL root that cannot resolve its relative entries must retain the
    // original metadata rather than silently become a native path.
    return null;
  }
  const encoded = Buffer.from(JSON.stringify(map), "utf8").toString("base64");
  return `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${encoded}`;
}

/** Normalize each embedded map without inventing root-level sources for an index. */
function absolutizeMap(
  map: { sources?: unknown; sourceRoot?: unknown; [key: string]: unknown },
  mapDir: string,
  sourceFile: string | undefined,
): void {
  if (Array.isArray(map.sections)) {
    for (const section of map.sections) {
      const child: unknown = section?.map;
      if (child === null || typeof child !== "object" || Array.isArray(child))
        throw new Error("unsupported external source-map section");
      // Sections can describe different originals; use each map's own anchor.
      absolutizeMap(child as typeof map, mapDir, undefined);
    }
  } else {
    map.sources = absolutizeSources(map, mapDir, sourceFile);
    // Absolute source URLs no longer use their former relative root.
    delete map.sourceRoot;
  }
}

/**
 * Map each entry of the source map's `sources` to an absolute `file://` URL.
 *
 * Tsgo's per-file emit is 1:1, so a single source is the served file itself and
 * resolves to the real on-disk `sourceFile` the serve path already knows — the
 * most reliable anchor. A map that somehow carries several sources (or is
 * consumed without a known source file) has each relative entry resolved
 * against the map's own directory and `sourceRoot`, exactly where tsgo computed
 * them from; entries that are already absolute URLs pass through unchanged.
 */
function absolutizeSources(
  map: { sources?: unknown; sourceRoot?: unknown },
  mapDir: string,
  sourceFile: string | undefined,
): string[] {
  const sources = Array.isArray(map.sources) ? map.sources : [];
  if (sources.length === 1 && sourceFile !== undefined) {
    return [pathToFileURL(sourceFile).href];
  }
  const sourceRoot = typeof map.sourceRoot === "string" ? map.sourceRoot : "";
  return sources.map((entry) => {
    if (typeof entry !== "string") {
      return String(entry);
    }
    if (path.isAbsolute(entry)) {
      return pathToFileURL(entry).href;
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(entry)) {
      return entry;
    }
    if (
      !path.isAbsolute(sourceRoot) &&
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(sourceRoot)
    ) {
      return new URL(
        entry,
        sourceRoot.endsWith("/") ? sourceRoot : `${sourceRoot}/`,
      ).href;
    }
    return pathToFileURL(path.resolve(mapDir, sourceRoot, entry)).href;
  });
}

function readFileOrNull(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}
