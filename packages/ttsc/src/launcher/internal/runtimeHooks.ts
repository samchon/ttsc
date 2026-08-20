import crypto from "node:crypto";
import fs from "node:fs";
import {
  Module,
  createRequire,
  isBuiltin,
  registerHooks,
  stripTypeScriptTypes,
} from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { runBuild } from "../../compiler/internal/runBuild";
import { outputText, spawnNative } from "../../compiler/internal/spawnNative";
import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import {
  type FilesystemPathIdentityContext,
  createFilesystemPathIdentityContext,
} from "../../internal/projectInputPathIdentity";
import { inlineServedSourceMap } from "./servedSourceMap";

/**
 * Synchronous Node module hooks installed (via `module.registerHooks`) in the
 * child process `ttsx` spawns to run a TypeScript entry _from source_.
 *
 * They give the runner ts-node-style whole-graph reach without weakening the
 * compile gate. The owning entry project is type-checked and built up front (by
 * `prepareExecution`, with its transform plugins such as typia); these hooks
 * serve that build under the source URLs so `__dirname`/`import.meta.url` keep
 * pointing at the source tree. Three load paths:
 *
 * 1. A `.ts` belonging to the entry project → serve the pre-built emitted JS
 *    (transform plugins already applied), mapped by the project's `rootDir`.
 * 2. Any other raw `.ts` dependency (a published or workspace package that ships
 *    source) → build its own owning `tsconfig.json` once via `runBuild` and
 *    serve the emit. A real build (not a type-strip) is required because Node's
 *    type-stripping cannot do cross-file type-only elision — e.g. a
 *    value-shaped import of a type+namespace merge survives stripping and
 *    dangles at runtime.
 * 3. No owning tsconfig → transform the lone file by the format it resolves to: a
 *    CommonJS-classified file (`.cts`, or a `.ts` in a package without `type:
 *    "module"`) is lowered to CommonJS through a tsgo single-file emit so its
 *    `export` syntax becomes `module.exports`; any other (ESM) file keeps the
 *    fast in-process `mode: "transform"` type-strip.
 *
 * The hooks are synchronous and run on the main thread (not a loader worker):
 * that is what lets a CommonJS `require("./x")` chain reach them and what makes
 * `require.resolve(..., { paths })` inside `runBuild`'s plugin loader behave.
 */

/** Source/JS extensions probed when an extensionless relative import fails. */
const RESOLVABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
] as const;

/** Union of the ttsx rescue probes and Node's built-in CommonJS probes. */
const DESCRIPTOR_PROBE_EXTENSIONS = [
  ...RESOLVABLE_EXTENSIONS,
  ".json",
  ".node",
] as const;

/** TypeScript source extensions these hooks compile. */
const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;

interface ResolveContext {
  readonly parentURL?: string;
  readonly conditions?: string[];
  readonly importAttributes?: Record<string, string | undefined>;
}

interface ResolveResult {
  url: string;
  format?: string | null;
  shortCircuit?: boolean;
}

interface LoadContext {
  readonly format?: string | null;
  readonly conditions?: string[];
  readonly importAttributes?: Record<string, string | undefined>;
}

interface LoadResult {
  format: string | null | undefined;
  source?: string | ArrayBuffer | NodeJS.TypedArray;
  shortCircuit?: boolean;
}

/**
 * The compiler options that decide the emit format of a file, as declared by
 * the project that emitted it. Both fields matter: tsgo derives the module kind
 * from `target` whenever `module` is absent, so carrying only `module` cannot
 * reproduce its decision.
 */
export interface OwningModuleOptions {
  module?: string;
  target?: string;
}

interface ServedSource {
  source: string;
  /** Options of the project that emitted this source; `null` when none did. */
  moduleOptions: OwningModuleOptions | null;
  emittedFile?: string;
  sourceFile?: string;
}

type NextResolve = (
  specifier: string,
  context: ResolveContext,
) => ResolveResult;
type NextLoad = (url: string, context: LoadContext) => LoadResult;

/**
 * Runtime manifest written by `runTtsx` (the parent) and read once here. It
 * describes the already-built entry project so the hooks can serve its emit.
 */
export interface RuntimeManifest {
  /** Project root of the entry's owning tsconfig. */
  projectRoot: string;
  /** Source-tree root the emit mirrors (tsgo strips this prefix). */
  rootDir: string;
  /** Directory holding the entry project's emitted JavaScript. */
  emitDir: string;
  /** Emitted file list from the entry build, for source→output matching. */
  emittedFiles?: readonly string[];
  /** Physical TypeScript root whose checked preparation created this manifest. */
  entrySource?: string;
  /** Exact JavaScript emitted for `entrySource`. */
  entryFile?: string;
  /**
   * The entry tsconfig's `module` and `target`, deciding emit CJS/ESM per file.
   * `target` is not decoration: an absent `module` makes tsgo derive the module
   * kind from it.
   */
  moduleOptions?: OwningModuleOptions;
  /** Root directory for per-dependency build output. */
  depCacheDir: string;
}

let environmentManifestCache: RuntimeManifest | null | undefined;
const registeredManifests: RuntimeManifest[] = [];

function environmentManifest(): RuntimeManifest | null {
  if (environmentManifestCache !== undefined) {
    return environmentManifestCache;
  }
  const file = process.env.TTSX_RUNTIME_MANIFEST;
  if (file === undefined || file.length === 0) {
    environmentManifestCache = null;
    return environmentManifestCache;
  }
  try {
    environmentManifestCache = JSON.parse(
      fs.readFileSync(file, "utf8"),
    ) as RuntimeManifest;
  } catch {
    environmentManifestCache = null;
  }
  return environmentManifestCache;
}

/** Every checked entry emit available to this runtime, in ownership order. */
function runtimeManifests(): readonly RuntimeManifest[] {
  const inherited = environmentManifest();
  return inherited === null
    ? registeredManifests
    : [inherited, ...registeredManifests];
}

/**
 * Lowest Node.js the ttsx source runtime supports. The synchronous
 * `module.registerHooks` (Node 22.15.0) is the highest floor among the runtime
 * APIs these hooks depend on — `stripTypeScriptTypes` (22.13.0) and the child's
 * `--disable-warning` flag (20.11.0) are both lower — so it sets the effective
 * minimum. Kept in sync with `packages/ttsc/package.json#engines.node` and the
 * documented requirement in `website/src/content/docs/development/index.mdx`.
 */
export const TTSX_MINIMUM_NODE_VERSION = "22.15.0";

const TTSX_MINIMUM_NODE_PARTS: readonly [number, number, number] = [22, 15, 0];

/**
 * Report why the running (or a candidate) Node.js version cannot execute the
 * ttsx source runtime, or `null` when it can. Returning an actionable message —
 * rather than letting the child die with an internal `TypeError` on the missing
 * `registerHooks`, or Node 18 rejecting `--disable-warning` with exit 9 — is
 * what turns an opaque internal failure into a clear version diagnostic.
 *
 * Exported for direct exercise by the ttsx e2e suite: the built launcher can
 * only be spawned under the Node version running the tests, so the boundary
 * around the floor cannot otherwise be pinned on CI.
 */
export function checkNodeRuntimeSupport(version: string): string | null {
  const parts = parseNodeVersion(version);
  if (parts === null) {
    // An unrecognizable version string is not proof of an unsupported runtime;
    // let execution proceed rather than block on a parsing quirk.
    return null;
  }
  if (compareVersionParts(parts, TTSX_MINIMUM_NODE_PARTS) >= 0) {
    return null;
  }
  return (
    `ttsx requires Node.js ${TTSX_MINIMUM_NODE_VERSION} or later, but this ` +
    `process is Node.js ${version}. The source runtime installs synchronous ` +
    `module hooks (module.registerHooks, Node 22.15.0) and strips types with ` +
    `module.stripTypeScriptTypes (Node 22.13.0), neither of which exists on ` +
    `earlier releases. Upgrade Node.js to 22.15.0+ (or the current LTS), or ` +
    `compile the project with \`ttsc\` and run the emitted JavaScript directly.`
  );
}

function parseNodeVersion(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (match === null) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersionParts(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  for (let index = 0; index < 3; index += 1) {
    if (a[index]! !== b[index]!) {
      return a[index]! < b[index]! ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Throw an actionable version error when the current Node.js cannot run the
 * ttsx source runtime. Guards the hook-installation boundary directly (a child
 * or grandchild that inherits the runtime preload under an unsupported Node) so
 * the failure is diagnosed here instead of surfacing as a bare `TypeError:
 * registerHooks is not a function`.
 */
function assertNodeRuntimeSupport(): void {
  const message = checkNodeRuntimeSupport(process.versions.node);
  if (message !== null) {
    throw new Error(message);
  }
}

let installed = false;
let prepareRuntimeEntry: ((filename: string) => RuntimeManifest) | undefined;

export interface RuntimeHookOptions {
  /** Prepare and type-check a TypeScript root discovered after registration. */
  prepareEntry?: (filename: string) => RuntimeManifest;
}

/**
 * Install the source-loading hooks on the current (main) thread. Idempotent:
 * the bootstrap installs them for the entry process, and `NODE_OPTIONS`
 * re-imports the installer in every child process the program spawns — both may
 * run in the same process.
 *
 * Two hooks are needed, because `module.registerHooks` does not intercept a
 * `require()` made from inside a CommonJS module that was itself reached
 * through an ESM `import` (the interop translator loads it on the raw CJS
 * path). The ESM graph goes through `registerHooks`; the CommonJS `require`
 * graph goes through `Module._extensions` and `Module._resolveFilename` — the
 * canonical loader extension points `ts-node`/`tsx` use for the same reason.
 *
 * Both halves of that second graph are required, and they answer different
 * questions. `_extensions` decides how a file that was _found_ is compiled, and
 * Node reuses its keys when it probes an extensionless request, so
 * `require("./x")` reaches `x.ts` for free. Nothing there resolves a request
 * that already carries an extension: `require("./x.js")` backed only by `x.ts`
 * is a resolution failure before any compiler is consulted, which is why the
 * rescue is installed on `_resolveFilename` as well (samchon/ttsc#1280).
 */
export function installRuntimeHooks(options: RuntimeHookOptions = {}): void {
  if (options.prepareEntry !== undefined) {
    prepareRuntimeEntry = options.prepareEntry;
  }
  if (installed) {
    return;
  }
  assertNodeRuntimeSupport();
  installed = true;
  // Map error stacks through the source maps the serve path now inlines, so a
  // thrown frame reports the true `.ts` line:col out of the box (no
  // `--enable-source-maps` needed). Applied before the entry loads; user code
  // that later toggles it wins, since this is a plain runtime switch.
  if (typeof process.setSourceMapsEnabled === "function") {
    process.setSourceMapsEnabled(true);
  }
  registerHooks({ load, resolve });
  installCommonJsHook();
  installCommonJsResolveHook();
}

/**
 * Register a CommonJS `require` handler for each TypeScript source extension so
 * a `require("./x")` chain compiles `.ts` the same way the ESM `load` hook
 * does.
 */
function installCommonJsHook(): void {
  const extensions = (
    Module as unknown as {
      _extensions: Record<
        string,
        (
          module: {
            _compile(source: string, filename: string): void;
            parent?: { filename?: string | null } | null;
          },
          filename: string,
        ) => void
      >;
    }
  )._extensions;
  const compile = (
    module: {
      _compile(source: string, filename: string): void;
      parent?: { filename?: string | null } | null;
    },
    filename: string,
  ): void => {
    const parent = module.parent?.filename;
    module._compile(
      resolveServedSource(
        filename,
        pathToFileURL(filename).href,
        typeof parent !== "string" || !isTypeScriptSource(parent),
      ).source,
      filename,
    );
  };
  for (const extension of [".ts", ".tsx", ".cts"]) {
    extensions[extension] = compile;
  }
}

/**
 * Map a JavaScript spelling back to its TypeScript source on the CommonJS
 * resolution path, so `require("./x.js")` finds `x.ts` when nothing emitted
 * `x.js`.
 *
 * TypeScript asks authors to write the emitted `.js` extension in a relative
 * specifier, so this spelling is the documented one rather than a mistake, and
 * the ESM `resolve` hook has always rescued it. The CommonJS graph could not,
 * and on Node 22 that graph is reached by every `require()` inside a CommonJS
 * module the ESM loader evaluated — `module.registerHooks` sees the `import()`
 * of that module and nothing within it. Node 24 routes the same `require`
 * through the hooks, which is why the gap was only ever visible on the oldest
 * runtime ttsx supports (`engines.node` is `>=22.15.0`).
 *
 * The wrapper only ever answers a request Node's own resolver already refused,
 * so a resolution that succeeds is never perturbed, and a request no candidate
 * satisfies rethrows Node's original error with its `MODULE_NOT_FOUND` code and
 * `requireStack` intact. `require.resolve` shares this entry point and is
 * rescued with it, except in its `{ paths }` form, which resolves against the
 * caller's list rather than the parent this reads.
 */
function installCommonJsResolveHook(): void {
  const internals = Module as unknown as {
    _resolveFilename(
      request: string,
      parent: { filename?: string | null } | null | undefined,
      isMain: boolean,
      options?: unknown,
    ): string;
  };
  const original = internals._resolveFilename;
  internals._resolveFilename = function resolveFilename(
    this: unknown,
    request: string,
    parent: { filename?: string | null } | null | undefined,
    isMain: boolean,
    options?: unknown,
  ): string {
    try {
      return original.call(this, request, parent, isMain, options);
    } catch (error) {
      const rescued = rescueCommonJsRequest(request, parent, options);
      if (rescued === null) {
        throw error;
      }
      return rescued;
    }
  };
}

/**
 * The TypeScript source a refused CommonJS request names, or `null`.
 *
 * Only a relative or absolute request can be rescued: a bare specifier is a
 * package lookup, whose own resolver already probed every extension the
 * installed `_extensions` keys declare.
 *
 * Two shapes decline before that. `_resolveFilename` is an internal entry point
 * anything may call, so a non-string request reaches here as readily as a
 * specifier does, and reading it would replace Node's own argument error with a
 * `TypeError` from this file. And `require.resolve(request, { paths })`
 * resolves against the caller's list, which this rescue does not consult, so
 * answering it from the parent's directory would be a different question's
 * answer.
 */
function rescueCommonJsRequest(
  request: string,
  parent: { filename?: string | null } | null | undefined,
  options?: unknown,
): string | null {
  if (typeof request !== "string") {
    return null;
  }
  if (
    typeof options === "object" &&
    options !== null &&
    Array.isArray((options as { paths?: unknown }).paths)
  ) {
    return null;
  }
  let base: string;
  if (path.isAbsolute(request)) {
    base = request;
  } else if (isRelativeSpecifier(request)) {
    const from = parent?.filename;
    if (typeof from !== "string") {
      return null;
    }
    base = path.resolve(path.dirname(from), request);
  } else {
    return null;
  }
  for (const candidate of typescriptSourcesForJavaScriptSpecifier(base)) {
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * The module format of the entry source file, derived from the entry project's
 * compiler options (via the runtime manifest) the same way the served files are
 * classified. The bootstrap uses it to load the entry through a CommonJS
 * `require` or an ESM `import`.
 */
export function entryModuleFormat(entryFile: string): "module" | "commonjs" {
  const real = realPath(entryFile);
  const owner = findEntryEmit(real)?.manifest;
  return moduleFormat(
    entryFile,
    owner === undefined ? null : (owner.moduleOptions ?? {}),
  ) === "module"
    ? "module"
    : "commonjs";
}

/** TypeScript URLs resolved at a JavaScript-to-TypeScript entry boundary. */
const runtimeEntryUrls = new Set<string>();

/**
 * Rescue an extensionless or directory relative specifier that Node's resolver
 * rejected. Only runs after `nextResolve` throws, so a successful resolution is
 * never perturbed; a genuinely missing module finds no candidate and the
 * original error is rethrown, preserving `ERR_MODULE_NOT_FOUND`.
 */
function resolve(
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
): ResolveResult {
  recordPluginDescriptorResolutionCandidates(specifier, context.parentURL);
  try {
    const result = rememberRuntimeEntry(
      rememberCommonJsNamedInterop(
        restoreStrippedNodeBuiltinScheme(
          specifier,
          nextResolve(specifier, context),
        ),
        context,
      ),
      context,
    );
    recordPluginDescriptorResolution(specifier, context.parentURL, result.url);
    return result;
  } catch (error) {
    const rescued = probeRescuableSpecifier(specifier, context.parentURL);
    if (rescued === null) {
      throw error;
    }
    const result = rememberRuntimeEntry(
      rememberCommonJsNamedInterop(
        { shortCircuit: true, url: rescued },
        context,
      ),
      context,
    );
    recordPluginDescriptorResolution(specifier, context.parentURL, result.url);
    return result;
  }
}

/**
 * Fingerprint every path whose state can redirect one descriptor import.
 *
 * This runs before the real resolver. Reporting candidates only after the
 * descriptor finished would pair an earlier descriptor result with later file
 * state when a higher-priority candidate appeared during evaluation.
 */
function recordPluginDescriptorResolutionCandidates(
  specifier: string,
  parentURL: string | undefined,
): void {
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return;
  if (isBuiltin(specifier) || specifier.startsWith("node:")) return;
  const parent = runtimeFilePath(parentURL);
  if (parent === undefined) return;
  const recorded = new Set<string>();
  const record = (candidate: string): void => {
    const resolved = path.resolve(candidate);
    if (recorded.has(resolved)) return;
    recorded.add(resolved);
    recordPluginDescriptorInput({
      parent,
      resolved,
    });
  };
  const recordManifestTargets = (
    value: unknown,
    directory: string,
    allowBare: boolean = false,
  ): void => {
    if (typeof value === "string") {
      if (
        value !== "" &&
        (allowBare || value.startsWith("./") || value.startsWith("../"))
      ) {
        recordBase(path.resolve(directory, value));
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        recordManifestTargets(item, directory, allowBare);
      }
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const item of Object.values(value)) {
        recordManifestTargets(item, directory, allowBare);
      }
    }
  };
  const recordPackageManifests = (file: string): void => {
    for (
      let directory = path.dirname(file);
      ;
      directory = path.dirname(directory)
    ) {
      const manifest = path.join(directory, "package.json");
      record(manifest);
      if (isFile(manifest)) return;
      const parentDirectory = path.dirname(directory);
      if (parentDirectory === directory) return;
    }
  };
  const localBases = (value: string): string[] => {
    if (value.startsWith("file:")) return [fileURLToPath(value)];
    const raw = path.resolve(path.dirname(parent), value);
    const suffixStart = value.search(/[?#]/);
    if (suffixStart === -1) return [raw];
    const pathname = value.slice(0, suffixStart);
    return pathname === ""
      ? [raw]
      : [...new Set([raw, path.resolve(path.dirname(parent), pathname)])];
  };
  const bases = new Set<string>();
  const recordBase = (base: string): void => {
    const resolvedBase = path.resolve(base);
    if (bases.has(resolvedBase)) return;
    bases.add(resolvedBase);
    record(resolvedBase);
    for (const candidate of typescriptSourcesForJavaScriptSpecifier(
      resolvedBase,
    )) {
      record(candidate);
    }
    for (const extension of DESCRIPTOR_PROBE_EXTENSIONS) {
      record(resolvedBase + extension);
    }
    const manifestFile = path.join(resolvedBase, "package.json");
    record(manifestFile);
    for (const extension of DESCRIPTOR_PROBE_EXTENSIONS) {
      record(path.join(resolvedBase, `index${extension}`));
    }
    try {
      const manifest = JSON.parse(
        fs.readFileSync(manifestFile, "utf8").replace(/^\uFEFF/, ""),
      ) as Record<string, unknown>;
      recordManifestTargets(manifest.exports, resolvedBase);
      recordManifestTargets(manifest.module, resolvedBase, true);
      recordManifestTargets(manifest.main, resolvedBase, true);
    } catch {
      // The real resolver owns malformed package diagnostics.
    }
  };

  if (
    specifier.startsWith(".") ||
    path.isAbsolute(specifier) ||
    specifier.startsWith("file:")
  ) {
    try {
      for (const base of localBases(specifier)) {
        recordPackageManifests(base);
        if (isFile(base)) record(base);
        else recordBase(base);
      }
    } catch {
      // The real resolver owns invalid URL spellings.
    }
    return;
  }

  const parts = specifier.split("/");
  const packageParts = parts[0]?.startsWith("@")
    ? parts.slice(0, 2)
    : parts.slice(0, 1);
  if (packageParts.some((part) => part === undefined || part === "")) return;
  const packageName = packageParts.join("/");
  const subpath = parts.slice(packageParts.length);
  for (const searchPath of createRequire(parent).resolve.paths(specifier) ??
    []) {
    const packageDirectory = path.join(searchPath, packageName);
    recordBase(packageDirectory);
    if (subpath.length !== 0) {
      recordBase(path.join(packageDirectory, ...subpath));
    }
    // CommonJS resolution continues past an existing but unusable package
    // directory. Record every search root before the resolver runs so a
    // farther selected package retains evaluation-time hashes for its
    // superseding candidates.
  }
}

/**
 * Report one resolved descriptor edge to the parent loader. The channel is
 * armed by the generated descriptor shim only after ttsx's own bootstrap and
 * imports have loaded, keeping compiler implementation files out of the
 * project's persistent-cache inputs.
 */
function recordPluginDescriptorResolution(
  specifier: string,
  parentURL: string | undefined,
  resolvedURL: string,
): void {
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return;
  const out = process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT;
  if (out === undefined || out.length === 0) return;
  const resolved = runtimeFilePath(resolvedURL);
  if (resolved === undefined) return;
  const parent = runtimeFilePath(parentURL);
  recordPluginDescriptorInput({
    ...(parent === undefined ? {} : { parent }),
    resolved,
    specifier,
  });
  for (
    let directory = path.dirname(resolved);
    ;
    directory = path.dirname(directory)
  ) {
    const manifest = path.join(directory, "package.json");
    recordPluginDescriptorInput({
      ...(parent === undefined ? {} : { parent }),
      resolved: manifest,
    });
    if (isFile(manifest)) break;
    const parentDirectory = path.dirname(directory);
    if (parentDirectory === directory) break;
  }
}

function recordPluginDescriptorInput(record: {
  hash?: string | null;
  parent?: string;
  realpath?: string | null;
  resolved: string;
  signature?: string;
  specifier?: string;
  unstable?: boolean;
}): void {
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return;
  const out = process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT;
  if (out === undefined || out.length === 0) return;
  recordPluginDescriptorInputOnce(record);
  const resolved = path.resolve(record.resolved);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  const relative = path.relative(parsed.root, resolved);
  for (const segment of relative.split(path.sep).slice(0, -1)) {
    if (segment === "") continue;
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        recordPluginDescriptorInputOnce({ resolved: current });
      }
    } catch {
      break;
    }
  }
}

/** Record one path without recursively revisiting its lexical ancestors. */
function recordPluginDescriptorInputOnce(record: {
  hash?: string | null;
  parent?: string;
  realpath?: string | null;
  resolved: string;
  signature?: string;
  specifier?: string;
  unstable?: boolean;
}): void {
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return;
  const out = process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT;
  if (out === undefined || out.length === 0) return;
  try {
    const beforeSignature = pluginDescriptorInputMetadataSignature(
      record.resolved,
    );
    const observedHash = pluginDescriptorInputHash(record.resolved);
    const observedRealpath = pluginDescriptorInputRealpath(record.resolved);
    const afterSignature = pluginDescriptorInputMetadataSignature(
      record.resolved,
    );
    const unstable =
      record.unstable === true ||
      beforeSignature === undefined ||
      afterSignature === undefined ||
      beforeSignature !== afterSignature ||
      (record.hash !== undefined && record.hash !== observedHash) ||
      (record.realpath !== undefined && record.realpath !== observedRealpath) ||
      (record.signature !== undefined && record.signature !== afterSignature);
    fs.appendFileSync(
      out,
      `${JSON.stringify({
        ...record,
        hash: observedHash,
        realpath: observedRealpath,
        ...(unstable ? { unstable: true } : { signature: afterSignature }),
      })}\n`,
      "utf8",
    );
  } catch {
    // Dependency reporting is advisory to cache reuse; the selected entry is
    // still retained by the parent if this best-effort side channel fails.
  }
}

function pluginDescriptorInputRealpath(file: string): string | null {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return null;
  }
}

/** Metadata identity that exposes content-preserving A-B-A replacement. */
function pluginDescriptorInputMetadataSignature(
  file: string,
): string | undefined {
  const requested = path.resolve(file);
  let current = requested;
  for (;;) {
    try {
      const link = fs.lstatSync(current, { bigint: true });
      let target = link;
      if (link.isSymbolicLink()) {
        try {
          target = fs.statSync(current, { bigint: true });
        } catch {
          // A broken link's own metadata cannot expose its target appearing
          // and disappearing during evaluation. Decline cache proof instead.
          return undefined;
        }
      }
      return [
        path.relative(current, requested),
        link.dev,
        link.ino,
        link.mode,
        link.size,
        link.mtimeNs,
        link.ctimeNs,
        target.dev,
        target.ino,
        target.mode,
        target.size,
        target.mtimeNs,
        target.ctimeNs,
      ].join(":");
    } catch (error) {
      if (!isMissingPathError(error)) return undefined;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

function pluginDescriptorInputHash(file: string): string | null {
  try {
    if (fs.statSync(file).isDirectory()) {
      return pluginDescriptorDirectoryHash();
    }
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
  } catch {
    return null;
  }
}

/** Stable public fingerprint for an existing directory candidate's kind. */
function pluginDescriptorDirectoryHash(): string {
  return crypto
    .createHash("sha256")
    .update("ttsc:host-input:directory\0")
    .digest("hex");
}

function runtimeFilePath(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.startsWith("file:")) {
    try {
      return path.resolve(fileURLToPath(value));
    } catch {
      return undefined;
    }
  }
  return path.isAbsolute(value) ? path.resolve(value) : undefined;
}

/** Remember an ESM root until its synchronous load hook prepares the project. */
function rememberRuntimeEntry(
  result: ResolveResult,
  context: ResolveContext,
): ResolveResult {
  if (
    result.url.startsWith("file:") &&
    isTypeScriptSource(fileURLToPath(result.url)) &&
    (context.parentURL === undefined ||
      !context.parentURL.startsWith("file:") ||
      !isTypeScriptSource(fileURLToPath(context.parentURL)))
  ) {
    runtimeEntryUrls.add(result.url);
  }
  return result;
}

/**
 * Restore a `node:` builtin URL when affected Node releases return the exact
 * prefix-stripped spelling from their synchronous CommonJS resolver.
 *
 * Every other result passes through unchanged. In particular, a user hook that
 * intentionally remaps a `node:` specifier to another URL retains ownership of
 * that mapping, while ordinary and ESM builtin results already carrying the
 * scheme avoid an unnecessary copy.
 */
export function restoreStrippedNodeBuiltinScheme(
  specifier: string,
  result: ResolveResult,
): ResolveResult {
  return isBuiltin(specifier) &&
    specifier.startsWith("node:") &&
    result.url === specifier.slice("node:".length)
    ? { ...result, url: specifier }
    : result;
}

/** Cache of built projects keyed by owning tsconfig path. */
interface BuiltProject {
  emitDir: string;
  rootDir: string;
  emittedFiles?: readonly string[];
  moduleOptions: OwningModuleOptions;
}
const builtProjects = new Map<string, BuiltProject>();
// A descriptor evaluator's dependency emit must never be reused by another
// process. PIDs are eventually recycled while the disk cache persists, so PID
// alone cannot provide that isolation. One cryptographically random process
// nonce keeps every evaluator generation distinct while `builtProjects` still
// shares repeated imports inside this process.
const descriptorProcessCacheNonce = crypto.randomBytes(16).toString("hex");

/** File URLs whose CommonJS source was reached from an ESM parent import. */
const commonJsNamedInteropUrls = new Set<string>();
const commonJsNameScanSources = new Map<string, string | null>();

function load(
  url: string,
  context: LoadContext,
  nextLoad: NextLoad,
): LoadResult {
  if (!url.startsWith("file:")) {
    return nextLoad(url, context);
  }
  const filename = fileURLToPath(url);
  if (!isTypeScriptSource(filename)) {
    return nextLoad(url, context);
  }
  const { format, source } = resolveRuntimeSource(
    filename,
    url,
    runtimeEntryUrls.delete(url) || isProcessEntry(filename),
  );
  return {
    format,
    shortCircuit: true,
    source,
  };
}

function resolveRuntimeSource(
  filename: string,
  url: string = pathToFileURL(filename).href,
  prepareAsEntry: boolean = false,
): { format: string; source: string } {
  const served = resolveServedSource(filename, url, prepareAsEntry);
  const format = moduleFormat(filename, served.moduleOptions);
  return {
    format,
    source:
      format === "commonjs" && commonJsNamedInteropUrls.has(url)
        ? exposeCommonJsStarExports(
            served.source,
            served.emittedFile,
            served.sourceFile,
          )
        : served.source,
  };
}

/** Whether `filename` is the TypeScript main module named on Node's argv. */
function isProcessEntry(filename: string): boolean {
  const entry = process.argv[1];
  return (
    entry !== undefined &&
    isTypeScriptSource(entry) &&
    realPath(path.resolve(entry)) === realPath(filename)
  );
}

function rememberCommonJsNamedInterop(
  result: ResolveResult,
  context: ResolveContext,
): ResolveResult {
  if (shouldExposeCommonJsNamedExports(result.url, context.parentURL)) {
    commonJsNamedInteropUrls.add(result.url);
  }
  return result;
}

/**
 * Whether a CommonJS-classified TypeScript source reached from an ESM parent
 * needs its nested `export *` names exposed.
 *
 * Only the parent side is decided here. The child's own format is re-checked
 * authoritatively in `resolveRuntimeSource` against the format its served
 * source actually carries, so this predicate deliberately does not repeat that
 * check: doing so would need the child's owning project, which is not known
 * until the source is served, and an answer guessed from the nearest tsconfig
 * silently under-exposes a file that tsconfig does not compile.
 */
function shouldExposeCommonJsNamedExports(
  url: string,
  parentURL: string | undefined,
): boolean {
  if (
    parentURL === undefined ||
    !url.startsWith("file:") ||
    !parentURL.startsWith("file:")
  ) {
    return false;
  }
  const parentFile = fileURLToPath(parentURL);
  if (moduleFormat(parentFile, owningModuleOptions(parentFile)) !== "module") {
    return false;
  }
  return isTypeScriptSource(fileURLToPath(url));
}

/**
 * The emit-deciding compiler options of the project that owns `filename`, or
 * `null` when none does.
 *
 * The entry project owns a file only when it actually emitted it. Testing
 * `isWithin(rootDir)` alone would claim every file under a wide `rootDir` —
 * including the volume-root `rootDir` a config-loader project uses — and hand
 * them the entry project's options even though the dependency or orphan lane is
 * what serves them.
 */
function owningModuleOptions(filename: string): OwningModuleOptions | null {
  if (!isTypeScriptSource(filename)) {
    return null;
  }
  const real = realPath(filename);
  const owner = findEntryEmit(real)?.manifest;
  if (owner !== undefined) {
    return owner.moduleOptions ?? {};
  }
  const tsconfig = nearestTsconfig(real);
  if (tsconfig === null) {
    return null;
  }
  const cached = moduleOptionsCache.get(tsconfig);
  if (cached !== undefined) {
    return cached;
  }
  let options: OwningModuleOptions = {};
  try {
    const project = readPluginDescriptorProjectConfig(tsconfig);
    options = projectModuleOptions(project.compilerOptions);
  } catch {
    // The owning project cannot be read, so nothing is known about the format
    // it would have emitted. That is the same state as having no project at
    // all, and it is what the dependency lane will conclude too when its build
    // fails and the file falls through to the orphan type-strip.
    moduleOptionsCache.set(tsconfig, null);
    return null;
  }
  moduleOptionsCache.set(tsconfig, options);
  return options;
}

/**
 * Read one owning config while its discovered chain stays unchanged.
 *
 * A preliminary read discovers `extends`; an accepted read is bracketed by
 * equal fingerprints over that exact chain. If churn never settles, ttsx can
 * still execute the last project but reports every observed config as unstable,
 * preventing a later snapshot from certifying the torn result.
 */
function readPluginDescriptorProjectConfig(
  tsconfig: string,
): ReturnType<typeof readProjectConfig> {
  const read = () =>
    readProjectConfig({ cwd: path.dirname(tsconfig), tsconfig });
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return read();

  const observed = new Set<string>([path.resolve(tsconfig)]);
  let project: ReturnType<typeof readProjectConfig>;
  try {
    project = read();
  } catch (error) {
    recordPluginDescriptorProjectInputs(observed, true);
    throw error;
  }
  let inputs = normalizedProjectConfigPaths(project, tsconfig);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const input of inputs) observed.add(input);
    const before = pluginDescriptorInputHashes(inputs);
    const beforeRealpaths = pluginDescriptorInputRealpaths(inputs);
    const beforeSignatures = pluginDescriptorInputMetadataSignatures(inputs);
    let candidate: ReturnType<typeof readProjectConfig>;
    try {
      candidate = read();
    } catch (error) {
      recordPluginDescriptorProjectInputs(observed, true);
      throw error;
    }
    const candidateInputs = normalizedProjectConfigPaths(candidate, tsconfig);
    for (const input of candidateInputs) observed.add(input);
    const after = pluginDescriptorInputHashes(candidateInputs);
    const afterRealpaths = pluginDescriptorInputRealpaths(candidateInputs);
    const afterSignatures =
      pluginDescriptorInputMetadataSignatures(candidateInputs);
    if (
      equalPluginDescriptorInputLists(inputs, candidateInputs) &&
      equalPluginDescriptorInputHashes(before, after) &&
      equalPluginDescriptorInputHashes(beforeRealpaths, afterRealpaths) &&
      beforeSignatures !== undefined &&
      afterSignatures !== undefined &&
      equalPluginDescriptorInputHashes(beforeSignatures, afterSignatures)
    ) {
      for (const input of candidateInputs) {
        recordPluginDescriptorInput({
          hash: after[input]!,
          realpath: afterRealpaths[input]!,
          resolved: input,
          signature: afterSignatures[input]!,
        });
      }
      return candidate;
    }
    project = candidate;
    inputs = candidateInputs;
  }
  recordPluginDescriptorProjectInputs(observed, true);
  return project;
}

function normalizedProjectConfigPaths(
  project: ReturnType<typeof readProjectConfig>,
  requestedConfig: string,
): string[] {
  return [
    ...new Set(
      [requestedConfig, ...project.configPaths].map((file) =>
        path.resolve(file),
      ),
    ),
  ].sort();
}

function pluginDescriptorInputHashes(
  inputs: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(
    inputs.map((input) => [input, pluginDescriptorInputHash(input)]),
  );
}

function pluginDescriptorInputRealpaths(
  inputs: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(
    inputs.map((input) => [input, pluginDescriptorInputRealpath(input)]),
  );
}

function pluginDescriptorInputMetadataSignatures(
  inputs: readonly string[],
): Record<string, string> | undefined {
  const output: Record<string, string> = {};
  for (const input of inputs) {
    const signature = pluginDescriptorInputMetadataSignature(input);
    if (signature === undefined) return undefined;
    output[path.resolve(input)] = signature;
  }
  return output;
}

function equalPluginDescriptorInputLists(
  first: readonly string[],
  second: readonly string[],
): boolean {
  return (
    first.length === second.length &&
    first.every((input, index) => input === second[index])
  );
}

function equalPluginDescriptorInputHashes(
  first: Readonly<Record<string, string | null>>,
  second: Readonly<Record<string, string | null>>,
): boolean {
  return (
    Object.keys(first).length === Object.keys(second).length &&
    Object.entries(first).every(([input, hash]) => second[input] === hash)
  );
}

function recordPluginDescriptorProjectInputs(
  inputs: Iterable<string>,
  unstable: boolean,
): void {
  for (const input of inputs) {
    const resolved = path.resolve(input);
    recordPluginDescriptorInput({
      resolved,
      ...(unstable ? { unstable: true } : {}),
    });
  }
}

/** Narrow a resolved project's compiler options to the emit-format pair. */
export function projectModuleOptions(
  compilerOptions: Record<string, unknown>,
): OwningModuleOptions {
  return {
    ...(typeof compilerOptions.module === "string"
      ? { module: compilerOptions.module }
      : {}),
    ...(typeof compilerOptions.target === "string"
      ? { target: compilerOptions.target }
      : {}),
  };
}

/**
 * Resolve the JavaScript to run for a TypeScript source file, in priority
 * order: the entry project's pre-built emit (transform plugins applied), a
 * built raw `.ts` dependency, or — when no tsconfig owns it — a `mode:
 * "transform"` type-strip. Shared by the ESM `load` hook and the CommonJS
 * `require` handler.
 */
function resolveServedSource(
  filename: string,
  url: string = pathToFileURL(filename).href,
  prepareAsEntry: boolean = false,
): ServedSource {
  const real = realPath(filename);
  // Only the public preload can prepare a newly discovered root. Direct ttsx
  // has one pre-built manifest and historically relies on trailing-stem
  // recovery when Windows presents the same source through its short and long
  // temp-path spellings (the lint TypeScript-config loader is one such case).
  // Treating that boundary as prepare-only would discard the existing emit and
  // feed ESM source into CommonJS interop, producing ERR_REQUIRE_CYCLE_MODULE.
  const prepareEntry = prepareAsEntry ? prepareRuntimeEntry : undefined;
  // A JavaScript-to-TypeScript boundary is a new checked root unless an
  // existing manifest proves exact ownership. Trailing-stem recovery is not
  // ownership evidence: two out-of-include `index.ts` roots can otherwise map
  // to the first manifest's `index.js`, skipping the second root's diagnostics.
  let served = serveEntryEmit(real, prepareEntry === undefined);
  if (served !== null) {
    return withInlineSourceMap(served);
  }
  if (prepareEntry !== undefined) {
    registeredManifests.push(prepareEntry(real));
    served = serveEntryEmit(real);
    if (served === null) {
      throw new Error(`ttsx: prepared entry emit not found for ${filename}`);
    }
    return withInlineSourceMap(served);
  }
  const built = serveDependencyEmit(real);
  if (built !== null) {
    return withInlineSourceMap(built);
  }
  return {
    moduleOptions: null,
    sourceFile: filename,
    source: transformOrphanSource(filename, url),
  };
}

/**
 * Inline a served emit's external source map into its text and absolutize the
 * map's `sources`, so the JavaScript executed under the `.ts` source URL stays
 * self-describing after the per-run emit directory is deleted. Applied to both
 * the entry lane (`serveEntryEmit`) and the dependency lane
 * (`serveBuiltDependency`); the orphan type-strip lane carries no emitted map.
 */
function withInlineSourceMap(served: ServedSource): ServedSource {
  const source = inlineServedSourceMap(
    served.source,
    served.emittedFile,
    served.sourceFile,
  );
  return source === served.source ? served : { ...served, source };
}

/**
 * Transform a TypeScript source file that no tsconfig owns (a published or
 * vendored package that ships raw `.ts`/`.cts`/`.mts` straight under
 * `node_modules`), choosing the lowering by the format the file resolves to.
 *
 * Node's in-process `stripTypeScriptTypes` only erases type syntax; it never
 * rewrites ECMAScript `import`/`export` into CommonJS. That is correct for a
 * file Node will load as ESM, but wrong for one classified CommonJS — a `.cts`,
 * or a `.ts` in a package without `type: "module"` — when the author wrote it
 * with module syntax (`export const`, `export namespace`, `export function`).
 * Stripping leaves the `export` in place and Node's CommonJS loader dies with
 * `SyntaxError: Unexpected token 'export'`. So a CommonJS-format orphan is
 * lowered through a real tsgo `--module commonjs` single-file emit (which also
 * handles `export =`), exactly the format decision tsgo would have made for an
 * owning project; an ESM-format orphan keeps the fast in-process strip.
 */
function transformOrphanSource(filename: string, url: string): string {
  if (moduleFormat(filename, null) === "commonjs") {
    const lowered = emitOrphanAsCommonJs(filename);
    if (lowered !== null) {
      return lowered;
    }
  }
  return stripTypeScriptTypes(fs.readFileSync(filename, "utf8"), {
    mode: "transform",
    sourceUrl: url,
  });
}

/**
 * Lower a single CommonJS-format source file to CommonJS JavaScript by running
 * tsgo on the lone file with `--module commonjs`. Emit-only, no diagnostic gate
 * (the entry project's up-front check is the type gate), matching
 * `buildDependency`. Returns `null` when tsgo is unavailable or produced no
 * output, so the caller can fall back to the in-process strip.
 */
function emitOrphanAsCommonJs(filename: string): string | null {
  let tsgo: string;
  try {
    tsgo = resolveTsgo({ cwd: path.dirname(filename) }).binary;
  } catch {
    return null;
  }
  // Content-hash cache: a CJS-format orphan ('s tsgo single-file emit) is lowered
  // once and reused by every other process in the run, and across runs. Without
  // it a program that fans out into many processes (the automated test corpus
  // imports the same vendored `.ts` deps from thousands of generated files) would
  // re-spawn tsgo per file per process and crawl.
  const cacheFile = orphanCacheFile(filename, tsgo);
  if (cacheFile !== null) {
    const hit = readFileOrNull(cacheFile);
    if (hit !== null) {
      return hit;
    }
  }
  const outDir = createCanonicalTempDirectory("ttsx-orphan-");
  try {
    const res = spawnNative(
      tsgo,
      [
        filename,
        // The file is named on the command line, so any tsconfig tsgo would
        // discover by walking up (the consumer's own) must be ignored — both
        // because it is not this file's project and because tsgo errors out
        // ("tsconfig.json is present but will not be loaded") otherwise.
        "--ignoreConfig",
        "--module",
        "commonjs",
        "--target",
        "es2022",
        // This is an emit-only lowering: the entry project's up-front build is
        // the type gate, so the single-file pass does not need to type-check.
        // Skipping the check (and the lib check it implies) cuts the per-file
        // cost several-fold, which matters when a program generates and imports
        // thousands of raw `.ts` files at runtime (a fanned-out test corpus) and
        // each one would otherwise pay a full single-file check.
        "--noCheck",
        "--skipLibCheck",
        "--outDir",
        outDir,
        "--listEmittedFiles",
      ],
      { cwd: path.dirname(filename), encoding: "utf8" },
    );
    const emitted = parseFirstEmittedFile(outputText(res.stdout));
    const lowered = emitted === null ? null : readFileOrNull(emitted);
    if (lowered !== null && cacheFile !== null) {
      writeOrphanCache(cacheFile, lowered);
    }
    return lowered;
  } catch {
    return null;
  } finally {
    fs.rmSync(outDir, { force: true, recursive: true });
  }
}

/**
 * Emit a source file only for CommonJS export-name discovery.
 *
 * This intentionally does not read or write the runtime orphan cache. Name
 * discovery may inspect a source dependency without executing it, so sharing
 * that output with the runtime fallback would let a speculative scan affect a
 * later load path.
 */
function emitCommonJsForNameScan(filename: string): string | null {
  const real = realPath(filename);
  const cached = commonJsNameScanSources.get(real);
  if (cached !== undefined) {
    return cached;
  }
  let tsgo: string;
  try {
    tsgo = resolveTsgo({ cwd: path.dirname(real) }).binary;
  } catch {
    commonJsNameScanSources.set(real, null);
    return null;
  }
  const outDir = createCanonicalTempDirectory("ttsx-export-scan-");
  try {
    const res = spawnNative(
      tsgo,
      [
        real,
        "--ignoreConfig",
        "--module",
        "commonjs",
        "--target",
        "es2022",
        "--noCheck",
        "--skipLibCheck",
        "--outDir",
        outDir,
        "--listEmittedFiles",
      ],
      { cwd: path.dirname(real), encoding: "utf8" },
    );
    const emitted = pickEmittedJavaScript(
      real,
      parseEmittedFiles(outputText(res.stdout)),
    );
    const lowered = emitted === null ? null : readFileOrNull(emitted);
    commonJsNameScanSources.set(real, lowered);
    return lowered;
  } catch {
    commonJsNameScanSources.set(real, null);
    return null;
  } finally {
    fs.rmSync(outDir, { force: true, recursive: true });
  }
}

/**
 * Cache root for lowered orphan sources, shared per run (and across runs when
 * `TTSC_CACHE_DIR` points at a persisted directory).
 */
function orphanCacheRoot(): string {
  const base =
    process.env.TTSC_CACHE_DIR && process.env.TTSC_CACHE_DIR.length !== 0
      ? process.env.TTSC_CACHE_DIR
      : path.join(os.tmpdir(), "ttsc-orphan");
  return path.join(base, "ttsx-orphan-cjs");
}

/**
 * Content-addressed cache path for one orphan file's CommonJS lowering, keyed
 * by source bytes and the tsgo binary so a tsgo bump invalidates it. `null`
 * when the source cannot be read.
 */
function orphanCacheFile(filename: string, tsgo: string): string | null {
  let source: Buffer;
  try {
    source = fs.readFileSync(filename);
  } catch {
    return null;
  }
  const key = crypto
    .createHash("sha256")
    .update(tsgo)
    .update("\0")
    .update(source)
    .digest("hex")
    .slice(0, 32);
  return path.join(orphanCacheRoot(), `${key}.js`);
}

/**
 * Write the lowered source to its cache path atomically (temp + rename), so a
 * concurrent reader never sees a half-written file. Best-effort: a failure just
 * means the next process re-lowers.
 */
function writeOrphanCache(cacheFile: string, lowered: string): void {
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    const tmp = `${cacheFile}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, lowered);
    fs.renameSync(tmp, cacheFile);
  } catch {
    // ignore — caching is an optimization, correctness does not depend on it
  }
}

/** First `TSFILE:` path tsgo printed under `--listEmittedFiles`, or `null`. */
function parseFirstEmittedFile(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^TSFILE:\s*(.+)$/);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/** `TSFILE:` paths tsgo printed under `--listEmittedFiles`. */
function parseEmittedFiles(stdout: string): string[] {
  const files: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^TSFILE:\s*(.+)$/);
    if (match?.[1]) {
      files.push(match[1].trim());
    }
  }
  return files;
}

/** Pick the emitted JavaScript corresponding to the source file requested. */
function pickEmittedJavaScript(
  filename: string,
  emittedFiles: readonly string[],
): string | null {
  const stem = path
    .basename(filename)
    .replace(/\.[cm]?tsx?$/i, "")
    .toLowerCase();
  const candidates = emittedFiles.filter((file) => {
    const parsed = path.parse(file);
    return (
      parsed.name.toLowerCase() === stem && /\.(?:[cm]?js)$/i.test(parsed.base)
    );
  });
  if (candidates.length === 1) {
    return candidates[0]!;
  }
  return emittedFiles.find((file) => /\.(?:[cm]?js)$/i.test(file)) ?? null;
}

/**
 * Make TypeScript-Go's CommonJS `export *` output visible to Node's
 * ESM-from-CJS named export scanner.
 *
 * Tsgo lowers star re-exports to `__exportStar(require("./x"), exports)`.
 * Runtime CommonJS consumers see the getters that helper installs, but Node's
 * ESM linker only exposes named imports it can statically identify from
 * `exports.name = ...` assignments. For relative star re-exports whose emitted
 * target is available, replace the helper call with explicit configurable
 * export placeholders followed by the same `__createBinding` getter install.
 */
function exposeCommonJsStarExports(
  source: string,
  emittedFile: string | undefined,
  sourceFile: string | undefined,
): string {
  if (!source.includes("__exportStar(")) {
    return source;
  }
  const reserved = collectStaticCommonJsExportNames(source);
  let index = 0;
  return source.replace(
    /^(\s*)__exportStar\(\s*require\((["'])([^"']+)\2\)\s*,\s*exports\s*\);/gm,
    (statement: string, indent: string, _quote: string, specifier: string) => {
      const names = [
        ...collectStarExportNames(emittedFile, sourceFile, specifier),
      ].filter(
        (name) =>
          name !== "default" &&
          name !== "__esModule" &&
          isIdentifierName(name) &&
          !reserved.has(name),
      );
      if (names.length === 0) {
        return statement;
      }
      for (const name of names) {
        reserved.add(name);
      }
      const receiver = `__ttsx_export_star_${index++}`;
      return [
        ...names.map((name) => `${indent}exports.${name} = void 0;`),
        `${indent}var ${receiver} = require(${JSON.stringify(specifier)});`,
        ...names.map(
          (name) =>
            `${indent}__createBinding(exports, ${receiver}, ${JSON.stringify(name)});`,
        ),
      ].join("\n");
    },
  );
}

function collectStarExportNames(
  emittedFile: string | undefined,
  sourceFile: string | undefined,
  specifier: string,
): Set<string> {
  if (emittedFile !== undefined) {
    const emittedTarget = resolveEmittedRequire(emittedFile, specifier);
    if (emittedTarget !== null) {
      return collectCommonJsExportNames(emittedTarget, new Set());
    }
  }
  if (sourceFile !== undefined) {
    const sourceTarget = resolveSourceSpecifier(sourceFile, specifier);
    if (sourceTarget !== null) {
      return collectSourceCommonJsExportNames(sourceTarget, new Set());
    }
  }
  return new Set();
}

function collectCommonJsExportNames(
  emittedFile: string,
  seen: Set<string>,
): Set<string> {
  const real = realPath(emittedFile);
  if (seen.has(real)) {
    return new Set();
  }
  seen.add(real);
  const source = readFileOrNull(real);
  if (source === null) {
    return new Set();
  }
  const names = collectStaticCommonJsExportNames(source);
  for (const specifier of collectExportStarSpecifiers(source)) {
    const target = resolveEmittedRequire(real, specifier);
    if (target === null) {
      continue;
    }
    for (const name of collectCommonJsExportNames(target, seen)) {
      if (name !== "default" && name !== "__esModule" && !names.has(name)) {
        names.add(name);
      }
    }
  }
  return names;
}

function collectStaticCommonJsExportNames(source: string): Set<string> {
  // Scan executable syntax only. Text that merely resembles an assignment —
  // `exports.x =` inside a comment, string, or template-literal text — must not
  // become an ESM-visible export name, or a named import of it would link to
  // `undefined` for a property the CommonJS module never defines. Masking the
  // inert lexical spans before matching keeps genuine top-level assignments
  // (and executable `${ ... }` template substitutions) while dropping the
  // decoys.
  const scannable = maskCommentsAndStrings(source);
  const names = new Set<string>();
  const pattern =
    /(?:^|[^\w$])(?:exports|module\.exports)\.([A-Za-z_$][\w$]*)\s*=/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(scannable)) !== null) {
    names.add(match[1]!);
  }
  return names;
}

/**
 * Blank out the interior of line comments, block comments, string literals, and
 * template-literal text in emitted JavaScript, replacing each masked character
 * with a space while preserving newlines, code, and template `${ ... }`
 * substitutions verbatim. Positions and length are preserved so an offset in
 * the masked text maps back to the same offset in the source.
 *
 * The input is tsgo's CommonJS emit (well-formed JavaScript), so a character
 * scanner that tracks the standard comment/string/template states is sufficient
 * to separate executable tokens from inert text. Regular-expression literals
 * are intentionally not masked: distinguishing `/`-division from a regex
 * literal needs full tokenization, and tsgo's CommonJS emit never wraps an
 * `exports.<name> =` assignment inside a regex literal.
 */
function maskCommentsAndStrings(source: string): string {
  const out = source.split("");
  const n = out.length;
  const blank = (index: number): void => {
    const ch = out[index];
    if (ch !== "\n" && ch !== "\r") {
      out[index] = " ";
    }
  };
  // A stack of lexical contexts. The base is code; each backtick pushes a
  // template context, and each `${` inside a template pushes a nested code
  // context whose `braceDepth` tracks `{}` nesting so an object literal inside
  // the substitution does not end it early.
  interface Context {
    kind: "code" | "template";
    braceDepth: number;
  }
  const stack: Context[] = [{ kind: "code", braceDepth: 0 }];
  let i = 0;
  while (i < n) {
    const top = stack[stack.length - 1]!;
    const ch = out[i]!;
    if (top.kind === "template") {
      if (ch === "\\") {
        blank(i);
        blank(i + 1);
        i += 2;
        continue;
      }
      if (ch === "`") {
        blank(i);
        stack.pop();
        i += 1;
        continue;
      }
      if (ch === "$" && out[i + 1] === "{") {
        // Enter a code substitution: `${` and its contents stay executable.
        stack.push({ kind: "code", braceDepth: 0 });
        i += 2;
        continue;
      }
      blank(i);
      i += 1;
      continue;
    }
    // Code context.
    if (ch === "/" && out[i + 1] === "/") {
      blank(i);
      blank(i + 1);
      i += 2;
      while (i < n && out[i] !== "\n") {
        blank(i);
        i += 1;
      }
      continue;
    }
    if (ch === "/" && out[i + 1] === "*") {
      blank(i);
      blank(i + 1);
      i += 2;
      while (i < n && !(out[i] === "*" && out[i + 1] === "/")) {
        blank(i);
        i += 1;
      }
      if (i < n) {
        blank(i);
        blank(i + 1);
        i += 2;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      blank(i);
      i += 1;
      while (i < n && out[i] !== ch) {
        if (out[i] === "\\") {
          blank(i);
          blank(i + 1);
          i += 2;
          continue;
        }
        // A bare newline ends an unterminated string; stop masking so the rest
        // of the line is still scanned as code (defensive — tsgo never emits
        // one).
        if (out[i] === "\n") {
          break;
        }
        blank(i);
        i += 1;
      }
      if (i < n && out[i] === ch) {
        blank(i);
        i += 1;
      }
      continue;
    }
    if (ch === "`") {
      blank(i);
      stack.push({ kind: "template", braceDepth: 0 });
      i += 1;
      continue;
    }
    if (ch === "{") {
      top.braceDepth += 1;
      i += 1;
      continue;
    }
    if (ch === "}") {
      if (top.braceDepth === 0 && stack.length > 1) {
        // Close the enclosing template `${ ... }` and resume template text.
        stack.pop();
        i += 1;
        continue;
      }
      if (top.braceDepth > 0) {
        top.braceDepth -= 1;
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return out.join("");
}

function collectSourceCommonJsExportNames(
  sourceFile: string,
  seen: Set<string>,
): Set<string> {
  const real = realPath(sourceFile);
  if (seen.has(real)) {
    return new Set();
  }
  seen.add(real);
  const source = emitCommonJsForNameScan(real);
  if (source === null) {
    return new Set();
  }
  const names = collectStaticCommonJsExportNames(source);
  for (const specifier of collectExportStarSpecifiers(source)) {
    const target = resolveSourceSpecifier(real, specifier);
    if (target === null) {
      continue;
    }
    for (const name of collectSourceCommonJsExportNames(target, seen)) {
      if (name !== "default" && name !== "__esModule" && !names.has(name)) {
        names.add(name);
      }
    }
  }
  return names;
}

function collectExportStarSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern =
    /^(\s*)__exportStar\(\s*require\((["'])([^"']+)\2\)\s*,\s*exports\s*\);/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    specifiers.push(match[3]!);
  }
  return specifiers;
}

function resolveEmittedRequire(
  emittedFile: string,
  specifier: string,
): string | null {
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  const base = path.resolve(path.dirname(emittedFile), specifier);
  if (path.extname(base).length !== 0) {
    return isFile(base) ? base : null;
  }
  for (const extension of [".js", ".cjs", ".mjs"] as const) {
    const candidate = base + extension;
    if (isFile(candidate)) {
      return candidate;
    }
  }
  for (const extension of [".js", ".cjs", ".mjs"] as const) {
    const candidate = path.join(base, `index${extension}`);
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveSourceSpecifier(
  sourceFile: string,
  specifier: string,
): string | null {
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  const base = path.resolve(path.dirname(sourceFile), specifier);
  if (path.extname(base).length !== 0) {
    return isFile(base) ? base : null;
  }
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    const candidate = base + extension;
    if (isFile(candidate)) {
      return candidate;
    }
  }
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

function isIdentifierName(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

/**
 * Serve the entry project's pre-built JavaScript for a source file the build
 * emitted, or `null` when the file is outside the build or its emit is
 * missing.
 *
 * The bound is the project's `rootDir` (the source root the emit mirrors), not
 * its tsconfig directory: a project can pull in a file from elsewhere via
 * `files` with a wider `rootDir` (e.g. the lint config loader compiles a
 * `*.config.ts` from any directory under `rootDir: "/"`). Anything outside
 * `rootDir` cannot have a mirrored emit, so it falls through to the dependency
 * paths.
 */
function serveEntryEmit(
  real: string,
  allowStemFallback: boolean = true,
): ServedSource | null {
  const owner = findEntryEmit(real, allowStemFallback);
  if (owner === null) {
    return null;
  }
  const source = readFileOrNull(owner.emittedFile);
  return source === null
    ? null
    : {
        emittedFile: owner.emittedFile,
        moduleOptions: owner.manifest.moduleOptions ?? {},
        source,
        sourceFile: real,
      };
}

/**
 * Find the manifest that owns `real`. Explicit prepared roots win, followed by
 * exact mirrored paths across every manifest. Only then may legacy stem
 * recovery run, so one manifest's approximate match cannot shadow another's
 * exact emit.
 */
function findEntryEmit(
  real: string,
  allowStemFallback: boolean = true,
): { emittedFile: string; manifest: RuntimeManifest } | null {
  const manifests = runtimeManifests();
  for (const candidate of manifests) {
    if (
      candidate.entrySource !== undefined &&
      candidate.entryFile !== undefined &&
      realPath(candidate.entrySource) === real &&
      fs.existsSync(candidate.entryFile)
    ) {
      return { emittedFile: candidate.entryFile, manifest: candidate };
    }
  }
  for (const candidate of manifests) {
    const emitted = entryEmitPath(candidate, real, false);
    if (emitted !== null) {
      return { emittedFile: emitted, manifest: candidate };
    }
  }
  if (!allowStemFallback) {
    return null;
  }
  for (const candidate of manifests) {
    const emitted = entryEmitPath(candidate, real, true);
    if (emitted !== null) {
      return { emittedFile: emitted, manifest: candidate };
    }
  }
  return null;
}

/**
 * The entry project's emitted JavaScript for `real`, or `null` when that
 * project did not emit it. Shared with `owningModuleOptions` so "the entry
 * project owns this file" means exactly one thing in both places.
 */
function entryEmitPath(
  m: RuntimeManifest,
  real: string,
  allowStemFallback: boolean = true,
): string | null {
  const cache = allowStemFallback
    ? entryEmitPathCache
    : exactEntryEmitPathCache;
  let manifestCache = cache.get(m);
  if (manifestCache === undefined) {
    manifestCache = new Map<string, string | null>();
    cache.set(m, manifestCache);
  }
  if (manifestCache.has(real)) {
    return manifestCache.get(real) ?? null;
  }
  const resolved = isWithin(real, m.rootDir)
    ? resolveEmittedJavaScript({
        allowStemFallback,
        emittedFiles: m.emittedFiles,
        outDir: m.emitDir,
        projectRoot: m.rootDir,
        sourceFile: real,
      })
    : null;
  manifestCache.set(real, resolved);
  return resolved;
}

/**
 * Memo for `entryEmitPath`, because it is now on the `resolve` hook's path
 * through `owningModuleOptions` — once per import specifier — and a miss inside
 * `resolveEmittedJavaScript` walks the whole emit tree. The entry emit is
 * written once before the run starts and never changes under it. Registration
 * can add several independent entry emits, so the manifest is part of the cache
 * identity as well as the source path.
 */
const entryEmitPathCache = new WeakMap<
  RuntimeManifest,
  Map<string, string | null>
>();
const exactEntryEmitPathCache = new WeakMap<
  RuntimeManifest,
  Map<string, string | null>
>();

/**
 * True when `real` is `directory` itself or sits beneath it. Handles a root
 * `directory` (`/`, `C:\`): naively appending a separator would yield `//`,
 * which no path starts with, so a root `rootDir` project would serve nothing.
 * Both sides are normalized to native separators first: a manifest `rootDir`
 * arrives slash-normalized from the synthesized tsconfig (`C:/` on Windows)
 * while `real` paths are native, and a raw prefix comparison across the two
 * forms silently never matches. Filesystem identity preserves ordinary Windows
 * aliases while keeping case-distinct paths under an opted-in directory
 * separate. Exported for direct exercise by the ttsx e2e suite — spawned runs
 * cannot pin both Windows case-semantics branches on CI.
 */
export function isWithin(
  real: string,
  directory: string,
  identities: FilesystemPathIdentityContext = createFilesystemPathIdentityContext(
    { throwOnRealpathError: false },
  ),
): boolean {
  return identities.isWithin(directory, real);
}

/**
 * Build the project that owns `real` (nearest `tsconfig.json` above its real
 * path) and return its emitted JavaScript, or `null` when no tsconfig owns it
 * or the project does not emit it. The build honours the dependency's own
 * tsconfig (transform plugins included), so a source-shipping package that
 * needs a transform behaves correctly at runtime.
 */
function serveDependencyEmit(real: string): ServedSource | null {
  const tsconfig = nearestTsconfig(real);
  if (tsconfig === null) {
    return null;
  }
  let built: BuiltProject;
  try {
    built = ensureProjectBuilt(tsconfig);
  } catch {
    // The owning project produced no emit at all; fall back to type-stripping
    // this single file rather than failing the whole run.
    return null;
  }
  const served = serveBuiltDependency(built, real);
  if (served !== null) {
    return served;
  }
  return null;
}

function serveBuiltDependency(
  built: BuiltProject,
  real: string,
): ServedSource | null {
  const emitted = resolveEmittedJavaScript({
    emittedFiles: built.emittedFiles,
    outDir: built.emitDir,
    projectRoot: built.rootDir,
    sourceFile: real,
  });
  if (emitted === null) {
    return null;
  }
  const source = readFileOrNull(emitted);
  return source === null
    ? null
    : {
        emittedFile: emitted,
        moduleOptions: built.moduleOptions,
        source,
        sourceFile: real,
      };
}

/**
 * On-disk completion marker for a built dependency, shared across processes.
 *
 * `generation` names the exact immutable emit directory this marker describes
 * (`<cacheDir>/gen-<generation>`). Binding metadata to one generation is what
 * makes publication atomic: a reader that parses this marker reads the emit of
 * the SAME generation, never old metadata combined with a different, still
 * partially-written directory. The marker is the last thing a build writes, and
 * it is written by an atomic temp-and-rename, so a reader observes either one
 * complete old generation or one complete new generation.
 */
interface DependencyCacheMeta {
  generation: string;
  rootDir: string;
  moduleOptions?: OwningModuleOptions;
}

/**
 * Build the project that owns a dependency once per run and share the result
 * across every process the program spawns.
 *
 * A program (a benchmark, a worker pool) can fan out into many child processes,
 * each of which inherits the runtime manifest and would otherwise rebuild every
 * dependency from scratch — and worse, several at once into the same directory,
 * corrupting each other. So the build output is content-keyed under the shared
 * per-run cache: a finished build leaves a meta marker that any later process
 * (or a second import in this one) reuses, and concurrent first-builders are
 * serialised by an atomic lock directory.
 */
function ensureProjectBuilt(tsconfig: string): BuiltProject {
  const cached = builtProjects.get(tsconfig);
  if (cached !== undefined) {
    return cached;
  }
  const { cacheDir, lockDir, metaPath, root } = dependencyCachePaths(tsconfig);

  const reuse = readDependencyCache(cacheDir, metaPath);
  if (reuse !== null) {
    builtProjects.set(tsconfig, reuse);
    return reuse;
  }

  fs.mkdirSync(root, { recursive: true });
  const built = withBuildLock(cacheDir, metaPath, lockDir, () =>
    buildDependency(tsconfig, cacheDir, metaPath),
  );
  builtProjects.set(tsconfig, built);
  return built;
}

interface DependencyCachePaths {
  /** Container of this dependency's generation-stamped emit directories. */
  cacheDir: string;
  /** Fenced cross-process coordination directory (`<key>.lock`). */
  lockDir: string;
  /** Atomic completion pointer (`<key>.json`) naming the live generation. */
  metaPath: string;
  root: string;
}

function dependencyCachePaths(tsconfig: string): DependencyCachePaths {
  const key = dependencyCacheKey(tsconfig);
  const root = dependencyCacheRoot();
  return {
    cacheDir: path.join(root, key),
    lockDir: path.join(root, `${key}.lock`),
    metaPath: path.join(root, `${key}.json`),
    root,
  };
}

/** Derive one dependency cache key; exported for isolation regressions. */
export function dependencyCacheKey(
  tsconfig: string,
  options: {
    descriptorLoad?: boolean;
    descriptorNonce?: string;
  } = {},
): string {
  const descriptorLoad =
    options.descriptorLoad ?? process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1";
  return (
    crypto
      .createHash("sha256")
      .update(tsconfig)
      // Descriptor evaluation promises a result bound to this process's exact
      // input observations. Reusing an emit another evaluator built can pair
      // that process's old source/config bytes with this process's later hashes.
      // Keep ordinary ttsx worker sharing, but isolate descriptor builds with a
      // non-reusable process nonce; the in-process `builtProjects` map still
      // compiles each owning project once.
      .update(
        descriptorLoad
          ? `\0descriptor-process:${
              options.descriptorNonce ?? descriptorProcessCacheNonce
            }`
          : "",
      )
      .digest("hex")
      .slice(0, 16)
  );
}

/** The immutable emit directory of one build generation under `cacheDir`. */
function dependencyGenerationDir(cacheDir: string, generation: string): string {
  return path.join(cacheDir, `gen-${generation}`);
}

/** A fresh 128-bit build-generation identifier. */
function newDependencyGeneration(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** True for a well-formed 128-bit hex build generation. */
function isDependencyGeneration(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}

/**
 * Reuse a dependency another process (or an earlier import) already built.
 *
 * The completion marker names the exact emit generation, so this reads metadata
 * and emit as one unit: it returns a hit only when the marker parses to a valid
 * generation AND that generation's directory holds emitted JavaScript. A reader
 * that runs while a replacement build is populating a DIFFERENT generation
 * directory keeps returning the previous complete generation until the atomic
 * marker swap points at the new one — never a mix of old metadata and a partial
 * new emit.
 *
 * Exported for the ttsx dependency-cache regressions.
 */
export function readDependencyCache(
  cacheDir: string,
  metaPath: string,
): BuiltProject | null {
  let meta: DependencyCacheMeta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as DependencyCacheMeta;
  } catch {
    return null;
  }
  if (
    !isDependencyGeneration(meta.generation) ||
    typeof meta.rootDir !== "string" ||
    // A marker with no `moduleOptions` object predates this field and cannot
    // say which format its emit carries. Treating the absence as "no options"
    // would classify a CommonJS emit as an ES module, so the generation is
    // rejected and rebuilt instead. Every marker this version writes carries
    // the object, empty or not.
    typeof meta.moduleOptions !== "object" ||
    meta.moduleOptions === null ||
    Array.isArray(meta.moduleOptions)
  ) {
    return null;
  }
  const emitDir = dependencyGenerationDir(cacheDir, meta.generation);
  if (!emittedAnything(emitDir)) {
    return null;
  }
  return {
    emitDir,
    emittedFiles: undefined,
    moduleOptions: projectModuleOptions(
      meta.moduleOptions as Record<string, unknown>,
    ),
    // Resolved on the way out, not trusted as written. `rootDir` never gated
    // reuse — the marker's generation, module options, and a non-empty emit do
    // — so a marker carrying an unresolved spelling was already being reused,
    // and then served every file of that dependency through the whole-tree stem
    // rescan. The pass is idempotent and runs only on a hit, which
    // `ensureProjectBuilt` memoizes per tsconfig. A marker from an earlier ttsc
    // survives only under the shared `os.tmpdir()/ttsx-dep` fallback root; the
    // manifest's own `depCacheDir` is per-process and removed with the run.
    rootDir: resolvePhysicalPath(meta.rootDir),
  };
}

/**
 * Run `build` while holding the fenced lock for this dependency, re-checking
 * the cache once the lock is held (a concurrent builder may have just
 * finished). A loser polls for the winner's completion marker and, only when
 * the holding generation is provably abandoned (dead owner or the steal budget
 * elapsed), retires precisely that generation before retrying — never a
 * successor's.
 */
function withBuildLock(
  cacheDir: string,
  metaPath: string,
  lockDir: string,
  build: () => BuiltProject,
): BuiltProject {
  for (;;) {
    const reuse = readDependencyCache(cacheDir, metaPath);
    if (reuse !== null) {
      return reuse;
    }
    let lease: DependencyBuildLockLease | null;
    try {
      lease = acquireDependencyBuildLock(lockDir);
    } catch {
      // An unusable coordination directory must not silently skip the build.
      // Generation-stamped emit and the atomic marker swap still keep every
      // reader's view of publication consistent without the lock.
      return build();
    }
    if (lease === null) {
      const waited = waitForDependencyBuild(
        cacheDir,
        metaPath,
        lockDir,
        DEP_BUILD_LOCK_STEAL_MS,
      );
      if (waited.outcome === "built") {
        return waited.built;
      }
      if (waited.outcome === "abandoned") {
        // Retire only the generation this observation named. Losing the rename
        // race means the holder's own release (or another waiter) already made
        // progress, so a stale result never removes a live successor.
        reclaimDependencyBuildLock(lockDir, waited.fence);
      }
      // "released" needs no repair: the holder freed the lock normally, so
      // retry the ordinary acquisition.
      continue;
    }
    try {
      const reuseUnderLock = readDependencyCache(cacheDir, metaPath);
      return reuseUnderLock ?? build();
    } finally {
      releaseDependencyBuildLock(lockDir, lease);
    }
  }
}

/** Block the current (synchronous) thread for `ms` without busy-spinning. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Compile a dependency project into a fresh generation directory and publish
 * its completion marker atomically.
 *
 * The emit lands in `<cacheDir>/gen-<generation>`, a directory no other
 * generation or process shares, so it is never mutated in place while a reader
 * looks at it. Only after the emit is proven non-empty is the marker written by
 * temp-and-rename, binding metadata to that exact generation. A build that
 * produced no output drops its partial directory so a failed generation can
 * never be reused.
 */
function buildDependency(
  tsconfig: string,
  cacheDir: string,
  metaPath: string,
): BuiltProject {
  const project = readPluginDescriptorProjectConfig(tsconfig);
  const generation = newDependencyGeneration();
  const emitDir = dependencyGenerationDir(cacheDir, generation);
  fs.rmSync(emitDir, { force: true, recursive: true });
  fs.mkdirSync(emitDir, { recursive: true });
  const result = runBuild({
    cwd: project.root,
    emit: true,
    forceListEmittedFiles: true,
    outDir: emitDir,
    // The generation directory is an `outDir` this lane injected, not one the
    // dependency declared, and tsgo demands an explicit `rootDir` (TS5011) as
    // soon as any `outDir` is in play. Pinning the root tsgo would infer keeps
    // a source-shipping dependency that declares no output buildable, and it is
    // the same root `resolveDependencySourceRoot` publishes for it below —
    // without it that dependency falls back to type-stripping (issue #1172).
    pinInferredRootDir: true,
    // Emit a source map on the transient dependency emit (it never reaches the
    // dependency's published `lib/`) so the serve path can inline it under the
    // source URL, but only when the dependency configures none itself. Routed
    // as a dedicated build option, not a forwarded tsgo flag, so it never
    // reaches a native plugin host's argument parser (issue #353).
    forceRuntimeSourceMap:
      project.compilerOptions.sourceMap !== true &&
      project.compilerOptions.inlineSourceMap !== true,
    // Honour the dependency's own transform plugins: a source-shipping package
    // can itself depend on a transform (e.g. a fixture whose values are built
    // with `typia.createRandom`), and its runtime behaviour is wrong without it.
    // `runBuild` runs on this main thread, so its plugin resolution works the
    // same as the entry build's. The exception is loading a plugin descriptor
    // (`TTSC_PLUGIN_DESCRIPTOR_LOAD`): there the descriptor's own — possibly
    // self-hosting — transform must NOT run, or it re-enters plugin loading and
    // deadlocks, so every dependency in that graph builds with plugins off.
    plugins:
      process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1" ? false : undefined,
    quiet: true,
    resolvedProject: project,
    // Emit only: the entry project's up-front check is the type gate. A
    // dependency build pulls its own transitive sources into the program and
    // would otherwise fail on type diagnostics that belong to those packages
    // under their own (laxer) config — e.g. unused-type-parameter warnings in a
    // transitively imported library. We still want the type-aware emit (for
    // type-only elision), just not the error gate.
    skipDiagnosticsCheck: true,
    tsconfig,
  });
  // Success is "the project wrote JavaScript", not "the build reported a file
  // list": a native transform host (typia, @ttsc/banner, …) emits without
  // printing the `--listEmittedFiles` lines, so `result.emittedFiles` is empty
  // even on a clean build. A genuinely empty output directory is the real
  // failure; the caller then falls back to type-stripping the one file.
  if (!emittedAnything(emitDir)) {
    // Drop the failed generation so its partial directory can never be mistaken
    // for a reusable build.
    fs.rmSync(emitDir, { force: true, recursive: true });
    throw new Error(
      [
        `ttsx: dependency build produced no output for ${tsconfig}`,
        result.stderr || result.stdout,
      ]
        .filter((line) => line.trim().length !== 0)
        .join("\n"),
    );
  }
  const rootDir = resolveDependencySourceRoot(project);
  const moduleOptions = projectModuleOptions(project.compilerOptions);
  publishDependencyMeta(metaPath, { generation, moduleOptions, rootDir });
  return { emitDir, emittedFiles: undefined, moduleOptions, rootDir };
}

/**
 * Publish the completion marker atomically: write it to a private temp name in
 * the same directory, then rename onto `metaPath`. Node's rename replaces an
 * existing file atomically on POSIX and Windows alike, so a concurrent reader
 * sees either the whole previous marker or the whole new one, never a
 * half-written file. The marker is the LAST artifact a build writes, after its
 * generation's emit is complete, so observing the new marker guarantees the new
 * generation is complete.
 */
function publishDependencyMeta(
  metaPath: string,
  meta: DependencyCacheMeta,
): void {
  const tmp = `${metaPath}.${process.pid}.${Date.now()}.${crypto
    .randomBytes(6)
    .toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(meta), "utf8");
  try {
    fs.renameSync(tmp, metaPath);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

export function dependencyCacheRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  // Descriptor evaluators are disposable and must not leave one isolated emit
  // generation in the shared temp cache per load. Their result file already
  // lives in the evaluator-owned directory that the parent removes in
  // `finally`; put dependency emits beside it so that cleanup owns both.
  if (
    env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1" &&
    typeof env.TTSC_PLUGIN_DESCRIPTOR_OUT === "string" &&
    path.isAbsolute(env.TTSC_PLUGIN_DESCRIPTOR_OUT)
  ) {
    return path.join(
      path.dirname(env.TTSC_PLUGIN_DESCRIPTOR_OUT),
      "dependency-cache",
    );
  }
  const owner = runtimeManifests().find(
    (candidate) => candidate.depCacheDir.length !== 0,
  );
  return owner !== undefined
    ? owner.depCacheDir
    : path.join(os.tmpdir(), "ttsx-dep");
}

// -----------------------------------------------------------------------------
// Fenced dependency-build lock.
//
// The lock serialises concurrent first-builders of one dependency so the
// expensive `runBuild` runs once per key while the rest wait and reuse the
// published generation. It is generation-fenced so a stale observer or a former
// owner can never release a successor's lock:
//
//   * `<lockDir>/current` is the held generation — a directory carrying a
//     `generation` id and an `owner.json` (pid + hostname). A contender writes a
//     private candidate and atomically renames it onto `current`; a directory
//     rename cannot replace a non-empty `current`, so exactly one contender wins
//     with no empty-owner publication window.
//   * Release and reclaim both retire a generation by renaming `current` to its
//     deterministic tombstone `<lockDir>/retired/<generation>`. The only way to
//     free `current` is to create that tombstone, so a successor can acquire only
//     after its predecessor's tombstone exists. A late or duplicate retire of an
//     already-retired generation therefore finds the tombstone occupied and
//     fails atomically, and a reclaim that named an old generation can never move
//     a different successor into that old tombstone.
//
// This mirrors the source-plugin v2 protocol (`buildSourcePlugin.ts`) proven by
// issue #452 / PR #460, minus the legacy-compatibility layer: the ttsx
// dependency cache lives under a per-run directory with no shipped on-disk
// format to stay compatible with.
// -----------------------------------------------------------------------------

const DEP_BUILD_LOCK_STEAL_MS = 600_000;
const DEP_BUILD_LOCK_POLL_MS = 50;
const DEP_BUILD_LOCK_STALE_MS = 30_000;
const DEP_BUILD_LOCK_CURRENT_DIR = "current";
const DEP_BUILD_LOCK_RETIRED_DIR = "retired";
const DEP_BUILD_LOCK_GENERATION_FILE = "generation";
const DEP_BUILD_LOCK_OWNER_FILE = "owner.json";

/** Ownership token returned only to the process that acquired `current`. */
export type DependencyBuildLockLease = { generation: string };

/** Opaque identity of one observed lock generation. */
export type DependencyBuildLockFence = { generation: string };

/**
 * Atomically acquire the current generation of a dependency build lock, or
 * `null` when another process already holds it. Exported for the deterministic
 * multi-process cache regressions.
 */
export function acquireDependencyBuildLock(
  lockDir: string,
): DependencyBuildLockLease | null {
  ensureDependencyLockRoot(lockDir);
  const generation = newDependencyGeneration();
  const candidateDir = path.join(lockDir, `candidate-${generation}`);
  fs.mkdirSync(candidateDir);
  try {
    fs.writeFileSync(
      path.join(candidateDir, DEP_BUILD_LOCK_GENERATION_FILE),
      `${generation}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    writeDependencyLockOwner(candidateDir, generation);
    const currentDir = path.join(lockDir, DEP_BUILD_LOCK_CURRENT_DIR);
    try {
      fs.renameSync(candidateDir, currentDir);
    } catch (error) {
      if (
        isMissingPathError(error) ||
        isRenameDestinationOccupied(error, currentDir)
      ) {
        return null;
      }
      throw error;
    }
    return { generation };
  } finally {
    // The candidate name carries this process's random generation and can never
    // alias `current` or another contender's candidate.
    fs.rmSync(candidateDir, { force: true, recursive: true });
  }
}

/** Retire a held generation during the holder's `finally`. */
export function releaseDependencyBuildLock(
  lockDir: string,
  lease: DependencyBuildLockLease,
): boolean {
  return retireDependencyBuildLock(lockDir, lease.generation);
}

/**
 * Retire exactly the generation carried by an abandoned observation. Exported
 * for the deterministic multi-process cache regressions.
 */
export function reclaimDependencyBuildLock(
  lockDir: string,
  fence: DependencyBuildLockFence,
): boolean {
  return retireDependencyBuildLock(lockDir, fence.generation);
}

function retireDependencyBuildLock(
  lockDir: string,
  generation: string,
): boolean {
  if (!isDependencyGeneration(generation)) {
    return false;
  }
  const retiredDir = path.join(lockDir, DEP_BUILD_LOCK_RETIRED_DIR);
  try {
    fs.mkdirSync(retiredDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      if (isMissingPathError(error)) {
        return false;
      }
      throw error;
    }
  }
  const destination = path.join(retiredDir, generation);
  try {
    fs.renameSync(path.join(lockDir, DEP_BUILD_LOCK_CURRENT_DIR), destination);
    return true;
  } catch (error) {
    if (
      isMissingPathError(error) ||
      isRenameDestinationOccupied(error, destination)
    ) {
      return false;
    }
    throw error;
  }
}

/** One observation of a dependency build lock's state. */
export type DependencyBuildLockObservation =
  | { state: "active"; owner: string; fence: DependencyBuildLockFence }
  | { state: "abandoned"; reason: string; fence: DependencyBuildLockFence }
  | { state: "released" };

/**
 * Classify the current state of a dependency build lock directory. Exported for
 * the deterministic multi-process cache regressions.
 */
export function inspectDependencyBuildLock(
  lockDir: string,
  now: number,
): DependencyBuildLockObservation {
  const currentDir = path.join(lockDir, DEP_BUILD_LOCK_CURRENT_DIR);
  const generation = readDependencyLockGeneration(currentDir);
  if (generation === null) {
    if (dependencyLockAgeMs(currentDir, now) === null) {
      return { state: "released" };
    }
    // `current` exists without a readable generation id. Acquisition writes the
    // id into the candidate BEFORE the atomic rename, so this is a transient or
    // corrupt state; keep waiting rather than steal on ambiguous evidence.
    return {
      state: "active",
      owner: "lock generation without a readable id",
      fence: { generation: "" },
    };
  }
  const fence: DependencyBuildLockFence = { generation };
  const owner = readDependencyLockOwner(currentDir);
  if (owner !== null) {
    const label = describeDependencyLockOwner(owner);
    if (isLocalHostName(owner.hostname) && !isProcessAlive(owner.pid)) {
      return {
        state: "abandoned",
        reason: `${label} is no longer running`,
        fence,
      };
    }
    return { state: "active", owner: label, fence };
  }
  const ageMs = dependencyLockAgeMs(currentDir, now);
  if (ageMs === null) {
    return { state: "released" };
  }
  if (ageMs > DEP_BUILD_LOCK_STALE_MS) {
    return {
      state: "abandoned",
      reason: `lock generation has no ${DEP_BUILD_LOCK_OWNER_FILE} and is ${formatDuration(
        ageMs,
      )} old`,
      fence,
    };
  }
  return {
    state: "active",
    owner: `lock generation with no ${DEP_BUILD_LOCK_OWNER_FILE}`,
    fence,
  };
}

/** Outcome of one waiting session on another process's dependency build lock. */
type DependencyBuildWaitResult =
  | { outcome: "built"; built: BuiltProject }
  | { outcome: "released" }
  | { outcome: "abandoned"; reason: string; fence: DependencyBuildLockFence };

/** Poll for the locked builder to publish, up to `timeoutMs`. */
function waitForDependencyBuild(
  cacheDir: string,
  metaPath: string,
  lockDir: string,
  timeoutMs: number,
): DependencyBuildWaitResult {
  const startedAt = Date.now();
  for (;;) {
    const reuse = readDependencyCache(cacheDir, metaPath);
    if (reuse !== null) {
      return { outcome: "built", built: reuse };
    }
    const now = Date.now();
    const lock = inspectDependencyBuildLock(lockDir, now);
    if (lock.state === "released") {
      // The holder retired its generation between the cache check above and this
      // observation: prefer the marker if it landed in that window, otherwise
      // hand the free lock back to the caller to re-acquire.
      const built = readDependencyCache(cacheDir, metaPath);
      return built !== null
        ? { outcome: "built", built }
        : { outcome: "released" };
    }
    if (lock.state === "abandoned") {
      return { outcome: "abandoned", reason: lock.reason, fence: lock.fence };
    }
    if (now - startedAt > timeoutMs) {
      return {
        outcome: "abandoned",
        reason: `timed out after ${formatDuration(now - startedAt)}`,
        fence: lock.fence,
      };
    }
    sleepSync(DEP_BUILD_LOCK_POLL_MS);
  }
}

function ensureDependencyLockRoot(lockDir: string): void {
  fs.mkdirSync(path.join(lockDir, DEP_BUILD_LOCK_RETIRED_DIR), {
    recursive: true,
  });
}

interface DependencyLockOwner {
  hostname: string;
  pid: number;
  startedAt?: string;
}

function writeDependencyLockOwner(
  generationDir: string,
  generation: string,
): void {
  fs.writeFileSync(
    path.join(generationDir, DEP_BUILD_LOCK_OWNER_FILE),
    `${JSON.stringify({
      generation,
      hostname: os.hostname(),
      pid: process.pid,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );
}

function readDependencyLockOwner(
  generationDir: string,
): DependencyLockOwner | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(
        path.join(generationDir, DEP_BUILD_LOCK_OWNER_FILE),
        "utf8",
      ),
    ) as Record<string, unknown>;
    if (
      typeof parsed.hostname !== "string" ||
      typeof parsed.pid !== "number" ||
      !Number.isInteger(parsed.pid) ||
      parsed.pid <= 0
    ) {
      return null;
    }
    return {
      hostname: parsed.hostname,
      pid: parsed.pid,
      startedAt:
        typeof parsed.startedAt === "string" ? parsed.startedAt : undefined,
    };
  } catch {
    return null;
  }
}

function readDependencyLockGeneration(generationDir: string): string | null {
  try {
    const generation = fs
      .readFileSync(
        path.join(generationDir, DEP_BUILD_LOCK_GENERATION_FILE),
        "utf8",
      )
      .trim();
    return isDependencyGeneration(generation) ? generation : null;
  } catch {
    return null;
  }
}

/** Age of an observed lock directory, or `null` when it no longer exists. */
function dependencyLockAgeMs(
  generationDir: string,
  now: number,
): number | null {
  try {
    return Math.max(0, now - fs.statSync(generationDir).mtimeMs);
  } catch (error) {
    return isMissingPathError(error) ? null : 0;
  }
}

function describeDependencyLockOwner(owner: DependencyLockOwner): string {
  const started =
    owner.startedAt === undefined ? "" : ` started at ${owner.startedAt}`;
  return `pid ${owner.pid} on ${owner.hostname}${started}`;
}

function isLocalHostName(hostname: string): boolean {
  return hostname.toLowerCase() === os.hostname().toLowerCase();
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

function isRenameDestinationOccupied(
  error: unknown,
  destination: string,
): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EEXIST" || code === "ENOTEMPTY") {
    return true;
  }
  return (code === "EACCES" || code === "EPERM") && fs.existsSync(destination);
}

/** Render a millisecond duration for lock diagnostics (`137ms`, `42s`, `9m 3s`). */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) {
    return "an unknown time";
  }
  if (ms < 1_000) {
    return `${Math.max(0, Math.round(ms))}ms`;
  }
  const seconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${remainder}s`;
}

/** Owning-tsconfig cache keyed by directory, mirroring `packageTypeCache`. */
interface ITsconfigLookup {
  candidates: readonly string[];
  result: string | null;
}

const tsconfigCache = new Map<string, ITsconfigLookup>();
const moduleOptionsCache = new Map<string, OwningModuleOptions | null>();

/**
 * The nearest `tsconfig.json` at or above `file`'s directory, or `null`. The
 * walk stops at a `node_modules` boundary: a tsconfig above `node_modules`
 * belongs to the consumer, not to the published dependency inside it, so a
 * dependency that ships no tsconfig of its own has no owning project and is
 * type-stripped instead. A pnpm-symlinked workspace package is unaffected
 * because `file` is already its real path (outside `node_modules`).
 *
 * The walk is memoised per directory (the whole walked chain shares one
 * answer), so the thousands of files a fanned-out test corpus imports from the
 * same handful of projects do not each re-stat the same parent directories.
 */
function nearestTsconfig(file: string): string | null {
  let directory = path.dirname(file);
  const chain: string[] = [];
  for (;;) {
    const cached = tsconfigCache.get(directory);
    if (cached !== undefined) {
      if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") {
        return rememberTsconfig(chain, cached.result, cached.candidates);
      }
      // Bracket the cached selection with the same candidate observations the
      // parent later reconciles. A nearer config created between a liveness
      // check and reporting must conflict, not be paired with the cached
      // farther result and certified as current.
      recordPluginDescriptorTsconfigCandidates(cached.candidates);
      const current = nearestExistingTsconfig(cached.candidates);
      recordPluginDescriptorTsconfigCandidates(cached.candidates);
      if (current === cached.result) {
        return rememberTsconfig(chain, cached.result, cached.candidates);
      }
      // Descriptor factories can deliberately create a config before a lazy
      // import. A lookup cached while an earlier import ran must not keep
      // serving the orphan lane after the nearest candidate changed.
      tsconfigCache.delete(directory);
    }
    if (path.basename(directory) === "node_modules") {
      return rememberTsconfig(chain, null);
    }
    chain.push(directory);
    const candidate = path.join(directory, "tsconfig.json");
    recordPluginDescriptorTsconfigCandidates([candidate]);
    if (isFile(candidate)) {
      return rememberTsconfig(chain, candidate);
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return rememberTsconfig(chain, null);
    }
    directory = parent;
  }
}

function nearestExistingTsconfig(candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (isFile(candidate)) return path.resolve(candidate);
  }
  return null;
}

function rememberTsconfig(
  directories: readonly string[],
  result: string | null,
  tailCandidates: readonly string[] = [],
): string | null {
  let candidates = [...tailCandidates];
  for (let index = directories.length - 1; index >= 0; index -= 1) {
    const directory = directories[index]!;
    candidates = [path.join(directory, "tsconfig.json"), ...candidates];
    tsconfigCache.set(directory, { candidates, result });
  }
  return result;
}

/** Report every owning-config candidate observed by the nearest-config walk. */
function recordPluginDescriptorTsconfigCandidates(
  candidates: readonly string[],
): void {
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return;
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    recordPluginDescriptorInput({
      resolved,
    });
  }
}

function readFileOrNull(file: string | null): string | null {
  if (file === null) {
    return null;
  }
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/**
 * The physical path, in the same spelling the launcher decided on.
 *
 * `realpathSync.native` first, because the plain implementation resolves
 * reparse points but leaves a Windows 8.3 component alone — and `TEMP` is
 * `C:\Users\RUNNER~1\...` on a GitHub Windows runner. The launcher resolves the
 * entry through `fs.realpathSync.native`, so answering here with the short name
 * would put a `..` in `path.relative(rootDir, real)`, drop the exact-mirror
 * lane, and leave the entry to whatever the trailing-stem matcher picks.
 */
export function realPath(target: string): string {
  try {
    return fs.realpathSync.native?.(target) ?? fs.realpathSync(target);
  } catch {
    return target;
  }
}

/**
 * The physical spelling of a path, produced the way the served sources it will
 * be compared against are produced.
 *
 * `createFilesystemPathIdentityContext` is the same resolver the entry lane
 * uses (`prepareExecution.ts::resolveRuntimeSourceRoot`). For a path that
 * exists it is one `realpathSync.native`. For one that does not it resolves as
 * far as the filesystem goes and folds the missing tail by the case semantics
 * of the surviving ancestor, which costs a directory read and, on Windows, can
 * cost an `fsutil` query — worth knowing, but off the path a real dependency
 * root takes.
 *
 * Total on purpose. `throwOnRealpathError: false` silences a failed realpath,
 * but the case-sensitivity probe can still fail on its own (an unreadable
 * ancestor, a denied alternate-case `lstat`), and neither caller has anywhere
 * to put that: `readDependencyCache` is contracted to answer `null` rather than
 * throw, and `buildDependency` has already produced its emit. The unresolved
 * spelling is exactly what both had before this pass, so it is the fallback.
 */
function resolvePhysicalPath(location: string): string {
  try {
    return createFilesystemPathIdentityContext({
      throwOnRealpathError: false,
    }).resolve(location).path;
  } catch {
    return location;
  }
}

/**
 * The source-tree root a dependency's emit mirrors, in the spelling
 * `resolveEmittedJavaScript` compares a served source against.
 *
 * Both branches need the pass, for different reasons. A declared `rootDir`
 * arrives from `readProjectConfig` joined against the config that declared it
 * but never resolved, so a `rootDir` that is itself a symlinked directory stays
 * unresolved. `project.root` arrives through plain `fs.realpathSync`, which
 * follows reparse points but leaves a Windows 8.3 component alone — and
 * {@link realPath} uses `fs.realpathSync.native`, which expands it. Either way
 * `path.relative` puts a `..` in front of an in-project source,
 * `resolveExactEmittedFiles` returns nothing, and every served file of that
 * dependency falls to the trailing-stem matcher, which rescans the whole emit
 * tree per file because a dependency build publishes no emitted-file list.
 *
 * This is the pass the entry lane settled on for the same mixed pair; the two
 * lanes now read alike, `path.isAbsolute` guard included. `readProjectConfig`
 * absolutizes every path option against the config that declared it, so that
 * guard is a mirror of the entry lane rather than a live branch.
 */
function resolveDependencySourceRoot(
  project: ReturnType<typeof readProjectConfig>,
): string {
  const rootDir = project.compilerOptions.rootDir;
  return resolvePhysicalPath(
    typeof rootDir !== "string"
      ? project.root
      : path.isAbsolute(rootDir)
        ? rootDir
        : path.resolve(project.root, rootDir),
  );
}

/**
 * Map the JavaScript extension a relative `specifier` carries to the TypeScript
 * source extensions tsgo would have emitted it from. Running from source, a
 * `"./x.js"` import (whether authored or rewritten from `"./x.ts"` by
 * `--rewriteRelativeImportExtensions`) has no `.js` on disk — only `./x.ts`.
 */
const JS_TO_TS_EXTENSIONS: ReadonlyMap<string, readonly string[]> = new Map([
  [".js", [".ts", ".tsx"]],
  [".jsx", [".tsx"]],
  [".mjs", [".mts"]],
  [".cjs", [".cts"]],
]);

/** Candidate sources that can satisfy one missing JavaScript spelling. */
function typescriptSourcesForJavaScriptSpecifier(file: string): string[] {
  const extension = path.extname(file).toLowerCase();
  const substitutions = JS_TO_TS_EXTENSIONS.get(extension);
  if (substitutions === undefined) return [];
  const stem = file.slice(0, file.length - extension.length);
  return substitutions.map((candidate) => stem + candidate);
}

/**
 * Rescue a `specifier` that Node's resolver rejected: map a JavaScript
 * extension back to its TypeScript source, or probe candidate extensions /
 * directory indexes for an extensionless form. Returns a `file:` URL for the
 * first match, or `null` when nothing matches.
 *
 * Handles two shapes:
 *
 * - A relative specifier (`./x`) resolved against a `file:` parent — a normal
 *   `import`/`require` inside a served module;
 * - An already-absolute specifier with no parent — the main entry of a
 *   `child_process.fork(__dirname + "/servant.js")`. fork's main module reaches
 *   the resolve hook as an absolute `.js` path with `parentURL` undefined, and
 *   run-from-source ships only the `.ts`, so without this the child dies with
 *   `Cannot find module servant.js` and a tgrid master waits on it forever.
 */
function probeRescuableSpecifier(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  // A `?query` / `#hash` suffix is part of module identity, not the path; strip
  // it before resolving and re-attach it to the resolved URL so a loader keying
  // on the suffix (and `import.meta.url`) sees it preserved.
  const suffixStart = specifier.search(/[?#]/);
  const suffix = suffixStart === -1 ? "" : specifier.slice(suffixStart);
  const pathname =
    suffixStart === -1 ? specifier : specifier.slice(0, suffixStart);
  let base: string;
  if (isRelativeSpecifier(specifier)) {
    if (parentURL === undefined || !parentURL.startsWith("file:")) {
      return null;
    }
    const parentDir = path.dirname(fileURLToPath(parentURL));
    base = path.resolve(parentDir, pathname);
  } else if (path.isAbsolute(pathname)) {
    base = pathname;
  } else {
    return null;
  }
  const withSuffix = (candidate: string): string =>
    pathToFileURL(candidate).href + suffix;

  const jsExtension = path.extname(base).toLowerCase();
  const tsExtensions = JS_TO_TS_EXTENSIONS.get(jsExtension);
  if (tsExtensions !== undefined) {
    const stem = base.slice(0, base.length - jsExtension.length);
    for (const extension of tsExtensions) {
      const candidate = stem + extension;
      if (isFile(candidate)) {
        return withSuffix(candidate);
      }
    }
    return null;
  }
  if (hasConcreteExtension(pathname)) {
    return null;
  }
  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = base + extension;
    if (isFile(candidate)) {
      return withSuffix(candidate);
    }
  }
  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (isFile(candidate)) {
      return withSuffix(candidate);
    }
  }
  return null;
}

/**
 * Decide the module format the way Node and tsgo do — from configuration, never
 * by sniffing the emitted text.
 *
 * The file extension is authoritative first (`.mts`/`.mjs` → module,
 * `.cts`/`.cjs` → commonjs), exactly as tsgo's
 * `getImpliedNodeFormatForEmitWorker` checks it ahead of everything else.
 *
 * After that the decision belongs to the project that emitted the file, so
 * `options` is the whole compiler-option pair tsgo consults, not just `module`:
 * an absent `module` is NOT "ask Node", it is "derive the kind from `target`"
 * (tsgo's `getEmitModuleKind`), and TypeScript 7 defaults `target` to the
 * latest standard, which means ES modules. Only the `node*` family defers to
 * the nearest `package.json` `type`, because only that family makes tsgo
 * consult it.
 *
 * `options` is `null` for a file no tsconfig owns at all — a raw `.ts` shipped
 * under `node_modules`. Nothing emitted it, so Node's own rule is the only rule
 * there is, and the package `type` decides.
 */
function moduleFormat(
  filename: string,
  options: OwningModuleOptions | null,
): string {
  if (filename.endsWith(".mts") || filename.endsWith(".mjs")) {
    return "module";
  }
  if (filename.endsWith(".cts") || filename.endsWith(".cjs")) {
    return "commonjs";
  }
  if (options === null) {
    return nearestPackageType(filename);
  }
  // A package that states its `type` outright decides for the files inside it
  // whatever the module kind is. This is where a source-shipping dependency's
  // own declaration overrides the compiling project's `module`; see
  // `declaredNodeModulesPackageType` for why `node_modules` bounds it.
  const declared = declaredNodeModulesPackageType(filename);
  if (declared !== null) {
    return declared;
  }
  const kind = effectiveModuleKind(options);
  if (
    kind === "node16" ||
    kind === "node18" ||
    kind === "node20" ||
    kind === "nodenext"
  ) {
    return nearestPackageType(filename);
  }
  if (kind === "commonjs") {
    return "commonjs";
  }
  // Everything that remains (es2015 … esnext, and `preserve`, which keeps the
  // authored ESM syntax verbatim whatever the package `type` says) is emitted
  // as ECMAScript modules. `amd`, `umd`, and `system` are not among them:
  // TypeScript 7 removed all three, so a project declaring one cannot build,
  // and a file it would have owned reaches the run through the orphan lane
  // instead.
  return "module";
}

/**
 * The `"type"` a `node_modules` package states for `filename`, or `null`.
 *
 * Tsgo's `GetImpliedNodeFormatForEmitWorker` consults a file's
 * `packageJsonType` for **every** module kind, not just the `node*` family. So
 * a source-shipping dependency that declares `"type": "commonjs"` is emitted as
 * CommonJS even while the compiling project asks for `esnext`, and the mirror
 * has to honour the same override or Node is handed the wrong format.
 *
 * Outside `node_modules` that field is empty for every module kind this
 * override can change. `loadSourceFileMetaData` does fill it elsewhere — for a
 * file whose extension does not itself state the format (anything but `.mts`,
 * `.cts`, `.mjs`, `.cjs`) whose project sets `moduleResolution` to the
 * `node16`…`nodenext` family — but `program.go` rejects that resolution unless
 * `module` is in the same family, and for a `node*` `module` the package `type`
 * is already the whole answer, which the caller's own `node*` branch produces.
 * So answering from a manifest outside `node_modules` could only override the
 * project's own `module` option, the very confusion this classifier exists to
 * end.
 */
function declaredNodeModulesPackageType(
  filename: string,
): "module" | "commonjs" | null {
  if (!pathHasNodeModulesSegment(filename)) {
    return null;
  }
  return declaredPackageType(filename);
}

/**
 * Whether any path segment of `filename` is literally `node_modules`.
 *
 * Case-sensitive on every platform, because the upstream test this mirrors is a
 * case-sensitive substring search and Node's own resolver recognises only the
 * exact spelling. A directory named `Node_Modules` is a package store to
 * neither of them, and must not become one here.
 */
function pathHasNodeModulesSegment(filename: string): boolean {
  return filename.split(/[\\/]/).includes("node_modules");
}

/**
 * The `module` kind tsgo actually emits with, mirroring `getEmitModuleKind`:
 * the declared `module` when there is one, and otherwise the kind implied by
 * `target`. `"none"` is the spelling of an unset `module`, so it derives the
 * same way.
 */
function effectiveModuleKind(options: OwningModuleOptions): string {
  const declared = (options.module ?? "").toLowerCase();
  if (declared !== "" && declared !== "none") {
    return declared;
  }
  const target = (options.target ?? "").toLowerCase();
  if (target === "esnext") {
    return "esnext";
  }
  const year = scriptTargetYear(target);
  if (year === null) {
    // An unset `target` is `ScriptTargetLatestStandard` upstream, well above the
    // ES2022 boundary. Every other spelling lands here too: TypeScript 7 removed
    // `ES5` and dropped `ES3` entirely, and its only remaining targets are
    // year-numbered ones, so nothing that reaches emit derives CommonJS.
    return "es2022";
  }
  if (year >= 2022) return "es2022";
  if (year >= 2020) return "es2020";
  return "es2015";
}

/**
 * Year of an `ES<year>` script target, with `es6` normalized to its `es2015`
 * synonym. Returns `null` when the spelling is not a year-numbered target,
 * which the caller resolves to the modern default.
 */
function scriptTargetYear(target: string): number | null {
  if (target === "es6") {
    return 2015;
  }
  const match = /^es(\d{4})$/.exec(target);
  return match === null ? null : Number(match[1]);
}

/** Package-type cache keyed by directory, mirroring Node's own lookup walk. */
const packageTypeCache = new Map<string, "module" | "commonjs">();

function nearestPackageType(filename: string): "module" | "commonjs" {
  let directory = path.dirname(filename);
  const chain: string[] = [];
  while (true) {
    const cached = packageTypeCache.get(directory);
    if (cached !== undefined) {
      return rememberPackageType(chain, cached);
    }
    chain.push(directory);
    const type = readPackageType(directory);
    if (type !== null) {
      return rememberPackageType(chain, type);
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return rememberPackageType(chain, "commonjs");
    }
    directory = parent;
  }
}

function rememberPackageType(
  directories: readonly string[],
  type: "module" | "commonjs",
): "module" | "commonjs" {
  for (const directory of directories) {
    packageTypeCache.set(directory, type);
  }
  return type;
}

/** Read a directory's `package.json` `type`, or `null` when absent/invalid. */
function readPackageType(directory: string): "module" | "commonjs" | null {
  const manifestPath = path.join(directory, "package.json");
  if (!isFile(manifestPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      type?: unknown;
    };
    return parsed.type === "module" ? "module" : "commonjs";
  } catch {
    return "commonjs";
  }
}

/**
 * The `"type"` the nearest `package.json` states outright, or `null` when the
 * nearest manifest omits it (or there is none).
 *
 * `nearestPackageType` answers "what format would Node use", which defaults a
 * silent manifest to CommonJS. This answers the narrower question "did a
 * package actually say", which is what an override has to be built on: a
 * manifest that says nothing must not out-vote the compiling project's own
 * `module` option.
 */
function declaredPackageType(filename: string): "module" | "commonjs" | null {
  let directory = path.dirname(filename);
  while (true) {
    const manifestPath = path.join(directory, "package.json");
    if (isFile(manifestPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
          type?: unknown;
        };
        // The walk stops at the first manifest either way, exactly as Node's
        // package-scope lookup does; only the answer differs.
        return parsed.type === "module" || parsed.type === "commonjs"
          ? parsed.type
          : null;
      } catch {
        return null;
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  );
}

/** True when `specifier` already carries an extension Node can load directly. */
function hasConcreteExtension(specifier: string): boolean {
  return /\.(?:[cm]?jsx?|json|node|[cm]?tsx?)$/i.test(specifier);
}

function isTypeScriptSource(filename: string): boolean {
  return TYPESCRIPT_EXTENSIONS.some((extension) =>
    filename.endsWith(extension),
  );
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/** True when `directory` holds at least one emitted JavaScript file (any depth). */
function emittedAnything(directory: string): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (emittedAnything(full)) {
        return true;
      }
    } else if (entry.isFile() && /\.(?:[cm]?js)$/i.test(entry.name)) {
      return true;
    }
  }
  return false;
}
