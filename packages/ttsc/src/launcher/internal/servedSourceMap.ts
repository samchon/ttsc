import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Rewritten served text keyed by emitted file, so the work runs once per run. */
const inlineCache = new Map<string, string>();

/**
 * Trailing `//# sourceMappingURL=<url>` (or legacy `//@`) magic comment.
 * Anchored at end of text through any trailing whitespace, so it matches the
 * last comment whether tsgo emitted it with a newline, none, or a CRLF line
 * ending.
 */
const SOURCE_MAPPING_URL = /\/\/[#@] sourceMappingURL=([^\r\n]*)[ \t\r\n]*$/;

/**
 * Replace a served emit's trailing external `//# sourceMappingURL=<relative>`
 * comment with an inline `data:` URL whose `sources` are absolute `file://`
 * URLs of the true on-disk source files.
 *
 * Ttsx runs tsgo-built JavaScript under the ORIGINAL `.ts` source URL. When the
 * owning tsconfig emits external maps, the served text ends with a relative
 * `sourceMappingURL` that Node resolves against the `.ts` script URL — where no
 * `.js.map` exists — and that the per-run emit directory deletes at process
 * exit anyway. Node's V8 coverage then caches the script with `data: null` and
 * c8 misattributes lines (false 100%, issue #353); `--enable-source-maps`
 * cannot map stack frames. Inlining the map into the served text (which V8
 * captures at compile time) survives both the wrong resolution base and the
 * post-exit cleanup, and absolutizing `sources` fixes the mis-rooted paths that
 * mapped stack frames, debuggers, and IDE links would otherwise print.
 *
 * Idempotent: re-running it on already-inlined text (whose `sources` are
 * already absolute `file://` URLs) reproduces the same bytes, which keeps the
 * shared cross-process dependency cache deterministic.
 *
 * @param source - The emitted JavaScript text served under the source URL.
 * @param emittedFile - On-disk path of the emitted `.js`, beside its `.map`.
 * @param sourceFile - Real path of the `.ts` source the emit was built from.
 */
export function inlineServedSourceMap(
  source: string,
  emittedFile: string | undefined,
  sourceFile: string | undefined,
): string {
  if (emittedFile === undefined) {
    return source;
  }
  const cached = inlineCache.get(emittedFile);
  if (cached !== undefined) {
    return cached;
  }
  const rewritten = rewrite(source, emittedFile, sourceFile);
  inlineCache.set(emittedFile, rewritten);
  return rewritten;
}

function rewrite(
  source: string,
  emittedFile: string,
  sourceFile: string | undefined,
): string {
  const match = SOURCE_MAPPING_URL.exec(source);
  if (match === null) {
    return source;
  }
  const url = match[1]!.trim();
  if (url.length === 0) {
    return source;
  }
  const json = readMapJson(url, emittedFile);
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
  map.sources = absolutizeSources(map, path.dirname(emittedFile), sourceFile);
  // `sources` are now absolute `file://` URLs, so any `sourceRoot` prefix would
  // corrupt them — drop it.
  delete map.sourceRoot;
  const encoded = Buffer.from(JSON.stringify(map), "utf8").toString("base64");
  return `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${encoded}`;
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
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(entry)) {
      return entry;
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
