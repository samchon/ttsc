import { parse } from "acorn";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/**
 * Give a hook-served CommonJS module its own source-aware require function.
 *
 * Node's module-local require binding is writable. Adapting that binding keeps
 * the shared module cache and callable loader while leaving Node's resolver
 * and global extension registry untouched. Source maps account for the inserted
 * first-line columns; directive and hashbang semantics remain those of the body.
 *
 * @evidence contracts/common.md#principled-implementation The public load boundary supplies CommonJS source and its wrapper binding; an owned function delegates loading to createRequire's shared native cache. Acorn identifies real directives and comments before inserting bootstrap syntax.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns the source bootstrap and the function it installs; the runtime installer supplies its existing source-resolution policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Only the served module's local binding changes. No foreign resolver, module cache entry or global extension handler is replaced.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes binding ownership, public loader delegation and source-location preservation; members distinguish installation policy from per-module adaptation.
 * @evidence contracts/portability.md#os-neutral-implementation createRequire consumes the native module filename and pathToFileURL encodes map source identity; filesystem case decisions stay with the supplied runtime resolver.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups operations; source and function construction describe their processing costs below.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Runtime and Node cache owners decide evaluation reuse; the namespace does not cache transformed bodies.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Operations own their retained callback and per-module function lifetimes.
 */
export namespace CommonJsRuntimeSource {
  /**
   * Install the runtime's resolution policy before loading user modules.
   *
   * @evidence contracts/common.md#principled-implementation The callback receives Node's original resolver and actual module filename, keeping successful native resolutions authoritative.
   * @evidence contracts/common.md#clear-and-simple-design Installation stores one policy; per-module factories do not duplicate runtime project or descriptor-observation logic.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The callback is owned state and does not replace any Node method.
   * @evidence contracts/common.md#meaningful-documentation The native purpose states the ordering prerequisite and policy owner.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Storing the supplied callback accesses no filesystem, process or path representation; the resolver and per-module factory own those boundaries.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Assigning a callback selects no input-processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Policy installation does not authorize sharing a compiled result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources This helper instance retains one replaceable policy; its installation-owned global symbol slot retains the factory even if its CommonJS cache entry is removed. No per-request history or native handle is added.
   */
  export function configure(policy: Resolver): void {
    resolve = policy;
    factories[FACTORY_KEY] = create;
  }

  /**
   * Construct an owned require with local TypeScript extension advertisements.
   *
   * @evidence contracts/common.md#principled-implementation createRequire loads through Node's shared CommonJS cache; copied public properties preserve cache/main access, while a copied registry advertises the already-supported source extensions without changing their actual loader.
   * @evidence contracts/common.md#clear-and-simple-design The callable and resolve member share one filename anchor; source recovery remains in the configured policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Extension entries belong to this new function, not Module._extensions or a foreign require; no private loader slot is assigned.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies ownership and distinguishes advertisements from actual loading.
   * @evidence contracts/portability.md#os-neutral-implementation The public createRequire API takes the native filename; no OS-name or path-string case heuristic is introduced.
   * @evidence contracts/performance.md#efficient-algorithms Construction copies public require properties and E extension entries, including their property observations, and creates a native filename-anchored require. Calls delegate native resolution, module evaluation/cache work or the configured resolver; their cost is not bounded by construction or extension count.
   * @evidence contracts/performance.md#reuse-equivalent-work Callable loading delegates to Node's CommonJS cache; the configured resolve policy remains a distinct per-call operation, not a cached result of constructing the function.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The evaluated module owns the returned function, captured filename/native require and copied extension registry. Captured cache/main references share Node or original-require state rather than copying all cached modules; the factory adds no historical module collection or native handle.
   */
  export function create(original: NodeJS.Require, filename: string): NodeJS.Require {
    const native = createRequire(filename);
    const owned = ((specifier: string) => native(specifier)) as NodeJS.Require;
    Object.assign(owned, native, original);
    owned.resolve = ((specifier: string, options?: { paths?: string[] }) =>
      resolve(native.resolve, specifier, options, filename)) as NodeJS.RequireResolve;
    owned.resolve.paths = native.resolve.paths;
    owned.cache = original.cache ?? native.cache;
    owned.extensions = { ...(original.extensions ?? native.extensions) };
    for (const extension of [".ts", ".tsx", ".cts", ".mts"])
      owned.extensions[extension] = owned.extensions[".js"]!;
    return owned;
  }

  /**
   * Insert the local bootstrap without changing lines or directive semantics.
   * A module that declares its own top-level require function keeps that binding.
   * Flat and embedded indexed JSON maps retain their originals, including URI
   * parameters and percent encoding. Invalid optional metadata does not reject
   * otherwise executable JavaScript; an identity map describes that body instead.
   *
   * @evidence contracts/common.md#principled-implementation Acorn's CommonJS grammar identifies directive prologues, hoisted require declarations and actual trailing source-map comments. Flat mappings or indexed section offsets shift generated columns on exactly the insertion line, preserving original locations. Optional malformed or externally indexed maps do not become executable-syntax failures.
   * @evidence contracts/common.md#clear-and-simple-design Source adaptation constructs one prefix and one corresponding map adjustment; evaluation stays with Node rather than a second interpreter.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The bootstrap reads an installation-owned symbol factory through the public VM context API, independently of mutable require.cache entries and user wrapper declarations. User-owned hoisted require functions are left intact.
   * @evidence contracts/common.md#meaningful-documentation Native prose states line/directive preservation and the user-owned binding exception.
   * @evidence contracts/portability.md#os-neutral-implementation JSON quotes the installation key and actual native filename; the filename becomes a file URL only for source-map identity, preserving native and protocol spelling separately.
   * @evidence contracts/performance.md#efficient-algorithms Parsing, comments, source copying and construction scale with B source bytes and M decoded JSON/map text and sections. Recursive indexed-map processing uses nesting-dependent stack without a configured depth cap; a fallback first line adds C exact-column segments. Returned source contains encoded map bytes as well as the body.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Node's evaluation owner calls this operation once for each loaded body; this function retains no mutable-source cache.
   * @evidence contracts/performance.md#bound-retention-and-release-resources AST, comments and map data end with this call, scaling with source and map bytes; the returned body belongs to the loader. The installation owns one process-lifetime factory slot per helper location, replaced by configure without retaining body history.
   */
  export function prepare(source: string, filename: string): string {
    const comments: Array<{ end: number; start: number; text: string }> = [];
    const program = parse(source, {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      onComment: (_block, text, start, end) => comments.push({ end, start, text }),
    });
    if (program.body.some((node) => node.type === "FunctionDeclaration" && node.id?.name === "require"))
      return source;
    let strict = false;
    for (const node of program.body) {
      if (node.type !== "ExpressionStatement" || !("directive" in node)) break;
      if (node.directive === "use strict") strict = true;
    }
    const firstBreak = /\r\n|[\r\n\u2028\u2029]/.exec(source);
    if (source.startsWith("#!") && firstBreak === null) return source;
    const offset = source.startsWith("#!") ? firstBreak!.index + firstBreak![0].length : 0;
    const line = offset === 0 ? 0 : 1;
    factories[FACTORY_KEY] ??= create;
    const factoryExpression = `globalThis[Symbol.for(${JSON.stringify(FACTORY_NAME)})]`;
    const header = `${strict ? '"use strict";' : ""}require=require("node:vm").runInThisContext(${JSON.stringify(factoryExpression)})(require,${JSON.stringify(filename)});`;
    const trailing = comments.at(-1);
    const directive = trailing !== undefined && source.slice(trailing.end).trim() === ""
      ? /^\s*[#@]\s*sourceMappingURL\s*=\s*(\S+)\s*$/.exec(trailing.text)
      : null;
    let map: Record<string, unknown> | undefined;
    let body = source;
    const uri = directive?.[1];
    if (uri !== undefined) {
      map = adjustedInlineMap(uri, line, header.length);
    }
    if (map !== undefined) {
      body = source.slice(0, trailing!.start);
    } else {
      const rows = Array(source.split(/\r\n|[\r\n\u2028\u2029]/).length).fill("A");
      const first = source.slice(offset).split(/\r\n|[\r\n\u2028\u2029]/, 1)[0]!;
      rows[line] = encodeColumn(header.length) + "A" + encodeColumn(line) + "A" + ",CAAC".repeat(first.length);
      map = { version: 3, names: [], sources: [pathToFileURL(filename).href], sourcesContent: [source], mappings: rows.join(";") };
    }
    return body.slice(0, offset) + header + body.slice(offset) + "\n//# sourceMappingURL=data:application/json;base64," + Buffer.from(JSON.stringify(map)).toString("base64");
  }
}

type Resolver = (native: NodeJS.RequireResolve, specifier: string, options: { paths?: string[] } | undefined, filename: string) => string;
let resolve: Resolver = (native, specifier, options) => native(specifier, options);
// The installed hooks outlive individual CommonJS cache entries. This owned
// symbol retains one factory per helper location without mutating Node's cache.
const FACTORY_NAME = `ttsc.CommonJsRuntimeSource:${__filename}`;
const FACTORY_KEY = Symbol.for(FACTORY_NAME);
const factories = globalThis as unknown as Record<symbol, typeof CommonJsRuntimeSource.create | undefined>;
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Encode one nonnegative source-map VLQ column or line delta. */
function encodeColumn(value: number): string {
  let remaining = value * 2;
  let output = "";
  do {
    const digit = remaining % 32;
    remaining = Math.floor(remaining / 32);
    output += BASE64[digit + (remaining ? 32 : 0)];
  } while (remaining);
  return output;
}

/** Shift only the first generated column; subsequent segment deltas are relative. */
function shiftFirstColumn(row: string, amount: number): string {
  let value = 0;
  let power = 1;
  let index = 0;
  let digit: number;
  do {
    digit = BASE64.indexOf(row[index++]!);
    if (digit < 0) throw new Error("ttsx: malformed CommonJS source map column");
    value += (digit % 32) * power;
    power *= 32;
  } while (digit >= 32);
  if (value % 2 !== 0) throw new Error("ttsx: negative CommonJS source map column");
  return encodeColumn(value / 2 + amount) + row.slice(index);
}

/** Decode optional JSON metadata; malformed maps must not reject valid JavaScript. */
function adjustedInlineMap(uri: string, line: number, amount: number): Record<string, unknown> | undefined {
  const match = /^data:application\/json((?:;[^,]*)?),([\s\S]*)$/i.exec(uri);
  if (match === null) return undefined;
  try {
    const json = /(?:^|;)base64(?:;|$)/i.test(match[1]!)
      ? Buffer.from(match[2]!, "base64").toString("utf8")
      : decodeURIComponent(match[2]!);
    const map: unknown = JSON.parse(json);
    if (!shiftMapLine(map, line, amount)) return undefined;
    return map as Record<string, unknown>;
  } catch {
    // Source-map comments are optional debug metadata, not executable syntax.
    return undefined;
  }
}

/** Shift one generated line in a flat map or its recursively indexed sections. */
function shiftMapLine(value: unknown, line: number, amount: number): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const map = value as Record<string, unknown>;
  if (map.version !== 3) return false;
  if (typeof map.mappings === "string") {
    const rows = map.mappings.split(";");
    if (rows[line]) rows[line] = shiftFirstColumn(rows[line]!, amount);
    map.mappings = rows.join(";");
    return true;
  }
  if (!Array.isArray(map.sections)) return false;
  for (const value of map.sections) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const section = value as Record<string, unknown>;
    const offset = section.offset as { line?: unknown; column?: unknown } | undefined;
    if (offset === undefined || offset === null ||
      !Number.isSafeInteger(offset.line) || !Number.isSafeInteger(offset.column) ||
      (offset.line as number) < 0 || (offset.column as number) < 0) return false;
    const start = offset.line as number;
    if (!shiftMapLine(section.map, start < line ? line - start : -1, start < line ? amount : 0)) return false;
    if (start === line) {
      // Section columns affect their first line alone, exactly as the prefix does.
      offset.column = (offset.column as number) + amount;
    }
  }
  return true;
}
