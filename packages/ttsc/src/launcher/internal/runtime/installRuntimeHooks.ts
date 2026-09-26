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

import { EmitOwnershipIndex } from "../../../compiler/internal/EmitOwnershipIndex";
import { runBuild } from "../../../compiler/internal/build/runBuild";
import { readProjectConfig } from "../../../compiler/internal/project/readProjectConfig";
import { resolveOwningProjectConfig } from "../../../compiler/internal/project/resolveOwningProjectConfig";
import { resolveTsgo } from "../../../compiler/internal/resolveTsgo";
import { spawnNative } from "../../../compiler/internal/spawnNative";
import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { runHoldingLock } from "../../../internal/runHoldingLock";
import { moduleResolutionBaseSelects } from "../../../plugin/internal/load/moduleResolutionBaseSelects";
import { observeImportSearchRoots } from "../../../plugin/internal/load/observeImportSearchRoots";
import { visitImportMappedCandidates } from "../../../plugin/internal/load/visitImportMappedCandidates";
import { buildSingleRootProject } from "../buildSingleRootProject";
import { inlineServedSourceMap } from "../inlineServedSourceMap";
import { parseCommonJsExports } from "../parseCommonJsExports";
import { runtimeCompilerArgs } from "../runtimeCompilerArgs";
import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import type { DependencyBuildLockFence } from "./DependencyBuildLockFence";
import type { DependencyBuildLockLease } from "./DependencyBuildLockLease";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";
import type { OwningModuleOptions } from "./OwningModuleOptions";
import type { ResolveResult } from "./ResolveResult";
import { RuntimeFilesystem } from "./RuntimeFilesystem";
import type { RuntimeHookOptions } from "./RuntimeHookOptions";
import type { RuntimeManifest } from "./RuntimeManifest";
import { RuntimeManifestRegistry } from "./RuntimeManifestRegistry";
import { RuntimeModuleFormat } from "./RuntimeModuleFormat";
import { acquireDependencyBuildLock } from "./acquireDependencyBuildLock";
import { checkNodeRuntimeSupport } from "./checkNodeRuntimeSupport";
import { dependencyCacheKey } from "./dependencyCacheKey";
import { dependencyCacheRoot } from "./dependencyCacheRoot";
import { inspectDependencyBuildLock } from "./inspectDependencyBuildLock";
import { projectModuleOptions } from "./projectModuleOptions";
import { readDependencyCache } from "./readDependencyCache";
import { realPath } from "./realPath";
import { reclaimDependencyBuildLock } from "./reclaimDependencyBuildLock";
import { releaseDependencyBuildLock } from "./releaseDependencyBuildLock";
import { restoreStrippedNodeBuiltinScheme } from "./restoreStrippedNodeBuiltinScheme";

/**
 * Install the source-loading hooks on the current (main) thread. Idempotent:
 * the preload on `NODE_OPTIONS` installs them in the entry process and in every
 * child process the program spawns, and `ttsc/register` may install them again
 * in a process that already has them.
 *
 * The hooks give ttsx ts-node-style whole-graph reach without weakening the
 * compile gate. The owning entry project is type-checked and built up front (by
 * `prepareExecution`, with its transform plugins such as typia); these hooks
 * serve that build under the source URLs so `__dirname`/`import.meta.url` keep
 * pointing at the source tree. Three load paths:
 *
 * 1. A `.ts` belonging to the entry project: serve the pre-built emitted JS
 *    (transform plugins already applied), mapped by the project's `rootDir`.
 * 2. Any other raw `.ts` dependency (a published or workspace package that ships
 *    source): build its own owning `tsconfig.json` once via `runBuild` and
 *    serve the emit. A real build (not a type-strip) is required because Node's
 *    type-stripping cannot do cross-file type-only elision; a value-shaped
 *    import of a type+namespace merge survives stripping and dangles at run
 *    time.
 * 3. No owning tsconfig: use an isolated tsgo emit in the runtime module format,
 *    lowering standard decorators and CommonJS imports/exports. Type stripping
 *    remains recovery when no compiler emit is available.
 *
 * The hooks are synchronous and run on the main thread (not a loader worker):
 * that is what lets a CommonJS `require("./x")` chain reach them and what makes
 * `require.resolve(..., { paths })` inside `runBuild`'s plugin loader behave.
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
 * One emit policy for orphan execution and CommonJS export discovery. The
 * compiler ignores the consumer's config, lowers proposal syntax, and checks no
 * types because the entry build owns diagnostics. Isolation prevents imported
 * const-enum inlining and secondary emits, and keeps const enums as runtime
 * exports that the name scanner must also observe.
 *
 * With no config there is no `jsx` either, so a `.tsx` orphan is compiled with
 * the automatic runtime, the one mode that needs no factory in scope: its
 * import source is `react` unless a `@jsxImportSource` pragma in the file says
 * otherwise (samchon/ttsc#1408).
 */
const ISOLATED_EMIT_ARGS = [
  "--ignoreConfig",
  "--target",
  "es2022",
  "--jsx",
  "react-jsx",
  "--noCheck",
  "--skipLibCheck",
  "--noResolve",
  "--isolatedModules",
] as const;

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
    if (RuntimeFilesystem.isFile(candidate)) {
      return candidate;
    }
  }
  return null;
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
  const candidates = observePluginDescriptorResolutionCandidates(
    specifier,
    context.parentURL,
  );
  // The URL the resolution settled on, or `undefined` while it has not: a
  // resolution that throws probed every candidate, so all of them are kept.
  let selected: string | undefined;
  try {
    let result: ResolveResult;
    try {
      result = rememberRuntimeEntry(
        rememberCommonJsNamedInterop(
          restoreStrippedNodeBuiltinScheme(
            specifier,
            nextResolve(specifier, context),
          ),
          context,
        ),
        context,
      );
    } catch (error) {
      const rescued = probeRescuableSpecifier(specifier, context.parentURL);
      if (rescued === null) {
        throw error;
      }
      result = rememberRuntimeEntry(
        rememberCommonJsNamedInterop(
          { shortCircuit: true, url: rescued },
          context,
        ),
        context,
      );
    }
    selected = result.url;
    recordPluginDescriptorResolution(specifier, context.parentURL, result.url);
    return result;
  } finally {
    candidates.commit(selected);
  }
}

/**
 * Fingerprint every path whose state can redirect one descriptor import, and
 * report the ones the resolution could have read once it settles.
 *
 * The fingerprints are taken before the real resolver runs. Reporting
 * candidates only after the descriptor finished would pair an earlier
 * descriptor result with later file state when a higher-priority candidate
 * appeared during evaluation. They are reported only when the resolution
 * settles, because a bare specifier's search stops at the first root whose
 * package it selects (`moduleResolutionBaseSelects`): the roots after it were
 * never read, and a missing candidate there, proven absent by the metadata of a
 * directory as busy as a home directory, would cost the descriptor its cache
 * proof for a path that cannot have steered it. A resolution that fails read
 * every root, so `commit(undefined)` reports them all.
 */
function observePluginDescriptorResolutionCandidates(
  specifier: string,
  parentURL: string | undefined,
): { commit(selectedURL: string | undefined): void } {
  const inactive = { commit: () => undefined };
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return inactive;
  if (isBuiltin(specifier) || specifier.startsWith("node:")) return inactive;
  const parent = runtimeFilePath(parentURL);
  if (parent === undefined) return inactive;
  // A `#` specifier is looked up in the importer's own package `imports`, whose
  // manifest was recorded with the importer. When that maps it to a bare
  // package, the package's candidates up to the root that selected it are
  // inputs, named once the resolution settles (samchon/ttsc#1498).
  if (specifier.startsWith("#")) {
    const witnesses = observeImportSearchRoots(parent);
    return {
      commit: (selectedURL) => {
        const lines: string[] = [];
        visitImportMappedCandidates(
          parent,
          selectedURL === undefined ? undefined : runtimeFilePath(selectedURL),
          DESCRIPTOR_PROBE_EXTENSIONS,
          witnesses,
          (file, moved) => {
            lines.push(
              ...observePluginDescriptorInput({
                parent,
                resolved: file,
                ...(moved ? { unstable: true } : {}),
              }),
            );
          },
        );
        appendPluginDescriptorInputs(lines);
      },
    };
  }
  // Candidates of a relative or absolute specifier, and those of each search
  // root of a bare one, in search order.
  const local: string[] = [];
  const roots: { directory: string; lines: string[] }[] = [];
  let lines = local;
  const recorded = new Set<string>();
  const record = (candidate: string): void => {
    const resolved = path.resolve(candidate);
    if (recorded.has(resolved)) return;
    recorded.add(resolved);
    lines.push(
      ...observePluginDescriptorInput({
        parent,
        resolved,
      }),
    );
  };
  const commit = (selectedURL: string | undefined): void => {
    const selected =
      selectedURL === undefined ? undefined : runtimeFilePath(selectedURL);
    const reached = roots.findIndex((root) =>
      moduleResolutionBaseSelects(
        root.directory,
        selected,
        DESCRIPTOR_PROBE_EXTENSIONS,
      ),
    );
    appendPluginDescriptorInputs([
      ...local,
      ...(reached === -1 ? roots : roots.slice(0, reached + 1)).flatMap(
        (root) => root.lines,
      ),
    ]);
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
      if (RuntimeFilesystem.isFile(manifest)) return;
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
        if (RuntimeFilesystem.isFile(base)) record(base);
        else recordBase(base);
      }
    } catch {
      // The real resolver owns invalid URL spellings.
    }
    return { commit };
  }

  const parts = specifier.split("/");
  const packageParts = parts[0]?.startsWith("@")
    ? parts.slice(0, 2)
    : parts.slice(0, 1);
  if (packageParts.some((part) => part === undefined || part === "")) {
    return { commit };
  }
  const packageName = packageParts.join("/");
  const subpath = parts.slice(packageParts.length);
  for (const searchPath of createRequire(parent).resolve.paths(specifier) ??
    []) {
    const packageDirectory = path.join(searchPath, packageName);
    const root = { directory: packageDirectory, lines: [] as string[] };
    roots.push(root);
    lines = root.lines;
    recordBase(packageDirectory);
    if (subpath.length !== 0) {
      recordBase(path.join(packageDirectory, ...subpath));
    }
    // CommonJS resolution continues past an existing but unusable package
    // directory. Fingerprint every search root before the resolver runs so a
    // farther selected package retains evaluation-time hashes for its
    // superseding candidates.
  }
  return { commit };
}

/**
 * Report one resolved descriptor edge to the parent loader. The channel is
 * armed by the generated descriptor shim only after ttsx's own runtime and
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
    if (RuntimeFilesystem.isFile(manifest)) break;
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
  appendPluginDescriptorInputs(observePluginDescriptorInput(record));
}

/**
 * Observe one path and every symbolic link among its lexical ancestors, as the
 * lines `appendPluginDescriptorInputs` reports, without reporting them yet.
 */
function observePluginDescriptorInput(record: {
  hash?: string | null;
  parent?: string;
  realpath?: string | null;
  resolved: string;
  signature?: string;
  specifier?: string;
  unstable?: boolean;
}): string[] {
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return [];
  const out = process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT;
  if (out === undefined || out.length === 0) return [];
  const lines: string[] = [];
  const observe = (line: string | undefined): void => {
    if (line !== undefined) lines.push(line);
  };
  observe(observePluginDescriptorInputOnce(record));
  const resolved = path.resolve(record.resolved);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  const relative = path.relative(parsed.root, resolved);
  for (const segment of relative.split(path.sep).slice(0, -1)) {
    if (segment === "") continue;
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        observe(observePluginDescriptorInputOnce({ resolved: current }));
      }
    } catch {
      break;
    }
  }
  return lines;
}

/** Report observed lines to the parent loader, in the order given. */
function appendPluginDescriptorInputs(lines: readonly string[]): void {
  if (lines.length === 0) return;
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return;
  const out = process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT;
  if (out === undefined || out.length === 0) return;
  try {
    fs.appendFileSync(out, lines.join(""), "utf8");
  } catch {
    // Dependency reporting is advisory to cache reuse; the selected entry is
    // still retained by the parent if this best-effort side channel fails.
  }
}

/** Observe one path without recursively revisiting its lexical ancestors. */
function observePluginDescriptorInputOnce(record: {
  hash?: string | null;
  parent?: string;
  realpath?: string | null;
  resolved: string;
  signature?: string;
  specifier?: string;
  unstable?: boolean;
}): string | undefined {
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
    return `${JSON.stringify({
      ...record,
      hash: observedHash,
      realpath: observedRealpath,
      ...(unstable ? { unstable: true } : { signature: afterSignature }),
    })}\n`;
  } catch {
    // Dependency reporting is advisory to cache reuse; the selected entry is
    // still retained by the parent if this side channel cannot observe it.
    return undefined;
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
      if (!RuntimeFilesystem.isMissingPathError(error)) return undefined;
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

const builtProjects = new Map<string, DependencyBuildGeneration.BuiltProject>();

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
  const format = RuntimeModuleFormat.moduleFormat(
    filename,
    served.moduleOptions,
  );
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
  if (
    RuntimeModuleFormat.moduleFormat(
      parentFile,
      owningModuleOptions(parentFile),
    ) !== "module"
  ) {
    return false;
  }
  return isTypeScriptSource(fileURLToPath(url));
}

/**
 * The emit-deciding compiler options of the project that owns `filename`, or
 * `null` when none does.
 *
 * The entry project owns a file only when it actually emitted it. Testing
 * whether the file lies under `rootDir` would claim every file under a wide
 * `rootDir` — including the volume-root `rootDir` a config-loader project uses
 * — and hand them the entry project's options even though the dependency or
 * orphan lane is what serves them.
 */
function owningModuleOptions(filename: string): OwningModuleOptions | null {
  if (!isTypeScriptSource(filename)) {
    return null;
  }
  const real = realPath(filename);
  const owner = RuntimeManifestRegistry.findEntryEmit(real)?.manifest;
  if (owner !== undefined) {
    return owner.moduleOptions ?? {};
  }
  const tsconfig = owningTsconfig(real);
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
    // fails and the file falls through to the isolated orphan emit.
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

/**
 * Resolve the JavaScript to run for a TypeScript source file. Shared by the ESM
 * `load` hook and the CommonJS `require` handler.
 *
 * A file runs only from JavaScript a build provably compiled from that very
 * file, never from another file's output that shares its name
 * (samchon/ttsc#1382). The lanes, in order:
 *
 * 1. A checked entry build that compiled it (`ttsx`'s entry project, or a root
 *    `ttsc/register` prepared).
 * 2. At a JavaScript-to-TypeScript boundary under `ttsc/register`, a newly
 *    prepared checked root.
 * 3. The build of its nearest `tsconfig.json`, when that build compiled it, or
 *    else the file compiled alone through that project's options — see
 *    {@link serveProjectEmit}.
 * 4. An isolated emit, when no tsconfig owns it at all.
 */
function resolveServedSource(
  filename: string,
  url: string = pathToFileURL(filename).href,
  prepareAsEntry: boolean = false,
): ServedSource {
  const real = realPath(filename);
  let served = serveEntryEmit(real);
  if (served !== null) {
    return withInlineSourceMap(served);
  }
  // Only the public preload can prepare a newly discovered root; direct ttsx
  // prepared its one entry before the child started.
  const prepareEntry = prepareAsEntry ? prepareRuntimeEntry : undefined;
  if (prepareEntry !== undefined) {
    RuntimeManifestRegistry.registeredManifests.push(prepareEntry(real));
    served = serveEntryEmit(real);
    if (served === null) {
      throw new Error(`ttsx: prepared entry emit not found for ${filename}`);
    }
    return withInlineSourceMap(served);
  }
  const built = serveProjectEmit(real);
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
 * (`serveBuiltDependency`); the orphan lane inlines its own map before
 * caching.
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
 * Both module formats need the compiler: Node's type stripping neither lowers
 * standard decorators nor rewrites ESM exports for CommonJS. Use the existing
 * single-file emit with the file's own module format and a standard target.
 * Retain stripping as recovery when no compiler emit is available.
 */
function transformOrphanSource(filename: string, url: string): string {
  const format =
    RuntimeModuleFormat.moduleFormat(filename, null) === "commonjs"
      ? "commonjs"
      : "module";
  const lowered = emitOrphanSource(filename, format);
  if (lowered !== null) {
    return lowered;
  }
  return stripTypeScriptTypes(fs.readFileSync(filename, "utf8"), {
    mode: "transform",
    sourceUrl: url,
  });
}

/**
 * Lower a single source file to its runtime module format. Emit-only, no
 * diagnostic gate (the entry project's up-front check is the type gate),
 * matching `buildDependency`. Returns `null` when tsgo is unavailable or
 * produced no output, so the caller can fall back to the in-process strip.
 */
function emitOrphanSource(
  filename: string,
  format: "commonjs" | "module",
): string | null {
  let tsgo: string;
  try {
    tsgo = resolveTsgo({ cwd: path.dirname(filename) }).binary;
  } catch {
    return null;
  }
  // Content-hash cache: an orphan's tsgo single-file emit is lowered
  // once and reused by every other process in the run, and across runs. Without
  // it a program that fans out into many processes (the automated test corpus
  // imports the same vendored `.ts` deps from thousands of generated files) would
  // re-spawn tsgo per file per process and crawl.
  const cache = orphanCacheFile(filename, tsgo, format);
  if (cache !== null) {
    const hit = readFileOrNull(cache.file);
    if (hit !== null) {
      return hit;
    }
  }
  const outDir = createCanonicalTempDirectory("ttsx-orphan-");
  try {
    spawnNative(
      tsgo,
      [
        filename,
        "--module",
        format === "commonjs" ? "commonjs" : "esnext",
        ...ISOLATED_EMIT_ARGS,
        "--sourceMap",
        "--inlineSources",
        "--outDir",
        outDir,
      ],
      { cwd: path.dirname(filename), encoding: "utf8" },
    );
    const emitted = isolatedEmitOf(filename, outDir);
    const source = emitted === null ? null : readFileOrNull(emitted);
    const lowered =
      source === null
        ? null
        : inlineServedSourceMap(source, emitted!, filename);
    // The key names the bytes read for it and the compiler it was taken under,
    // and the emit read the file and ran the compiler again. Only a source that
    // held still across both reads, lowered by a compiler that is still the
    // keyed one, is what the key names; otherwise the lowering serves this run
    // and is not recorded (samchon/ttsc#1508, samchon/ttsc#1521).
    if (
      lowered !== null &&
      cache !== null &&
      orphanSourceHeld(filename, cache) &&
      compilerIdentity(tsgo) === cache.compiler
    ) {
      writeOrphanCache(cache.file, lowered);
    }
    return lowered;
  } catch {
    return null;
  } finally {
    fs.rmSync(outDir, { force: true, recursive: true });
  }
}

/**
 * Read actual owned output for CommonJS export-name discovery, falling back to
 * isolated emission only when no project emitted this source. Project
 * transforms and const-enum settings decide which names exist at runtime. An
 * ESM emit is lowered as JavaScript solely to scan its CommonJS names.
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
  // The owned lanes can fail loudly: a root the program reaches outside every
  // checked build stops the run when its check fails. A name scan only looks
  // ahead of that load, so it falls back to the isolated emit and leaves the
  // load itself to report the failure where it happens.
  let served: ServedSource | null;
  try {
    served = serveEntryEmit(real) ?? serveProjectEmit(real);
  } catch {
    served = null;
  }
  if (
    served !== null &&
    RuntimeModuleFormat.moduleFormat(real, served.moduleOptions) === "commonjs"
  ) {
    commonJsNameScanSources.set(real, served.source);
    return served.source;
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
    // Compile the owned JavaScript, not the original TypeScript whose project
    // may already have erased or transformed declarations. No source executes.
    const input = served === null ? real : path.join(outDir, "source.cts");
    if (served !== null) fs.writeFileSync(input, served.source);
    spawnNative(
      tsgo,
      [
        input,
        "--module",
        "commonjs",
        ...ISOLATED_EMIT_ARGS,
        "--outDir",
        outDir,
      ],
      { cwd: path.dirname(real), encoding: "utf8" },
    );
    const emitted = isolatedEmitOf(input, outDir);
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
  return path.join(base, "ttsx-orphan");
}

/**
 * What a compiler binary is, as far as the filesystem can say without reading
 * its whole content: its physical path, file identity, size, and modification
 * and change times. Replacing the binary, whether by a package upgrade, an
 * atomic swap, or a rewrite of a wrapper at the same path, changes at least one
 * of them; the change time moves with every write even when a rewrite keeps the
 * size and restores the modification time.
 *
 * Read afresh at every use, never remembered by path: a long-lived process can
 * lower orphans before and after the compiler at that path is replaced, and an
 * entry lowered by the new one must not be recorded under the old one's key for
 * a later process to adopt (samchon/ttsc#1521).
 */
function compilerIdentity(binary: string): string {
  try {
    const real = realPath(binary);
    const stat = fs.statSync(real, { bigint: true });
    return [
      real,
      stat.dev,
      stat.ino,
      stat.size,
      stat.mtimeNs,
      stat.ctimeNs,
    ].join("\0");
  } catch {
    return binary;
  }
}

/** The version of this ttsc package, which owns the orphan post-processing. */
function ownPackageVersion(): string {
  if (ownPackageVersionCache === undefined) {
    try {
      const manifest = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, "..", "..", "..", "..", "package.json"),
          "utf8",
        ),
      ) as { version?: unknown };
      ownPackageVersionCache =
        typeof manifest.version === "string" ? manifest.version : "unknown";
    } catch {
      ownPackageVersionCache = "unknown";
    }
  }
  return ownPackageVersionCache;
}

let ownPackageVersionCache: string | undefined;

/**
 * Content-addressed cache path for isolated orphan lowering, or `null` when the
 * source cannot be read.
 *
 * The cache outlives the run under `TTSC_CACHE_DIR`, so a hit has to prove the
 * current inputs would produce the cached text (samchon/ttsc#1405). The key
 * holds everything that decides it: the source's bytes and path (the inlined
 * map names the path), the module format, the emit arguments, the compiler that
 * lowers it, and the ttsc that post-processes it. The compiler is keyed by what
 * it is, not where it is: a flat `node_modules` upgrade replaces the binary at
 * the same path, and a key of the path alone kept serving the old compiler's
 * output.
 *
 * The source is read here, and the emit reads it again. The answer carries the
 * bytes and the file's metadata before they were read, so `orphanSourceHeld`
 * can prove the emit read the same source (samchon/ttsc#1508).
 */
function orphanCacheFile(
  filename: string,
  tsgo: string,
  format: "commonjs" | "module",
): {
  compiler: string;
  file: string;
  signature: string;
  source: Buffer;
} | null {
  const signature = orphanSourceSignature(filename);
  if (signature === undefined) return null;
  let source: Buffer;
  try {
    source = fs.readFileSync(filename);
  } catch {
    return null;
  }
  const compiler = compilerIdentity(tsgo);
  const key = crypto
    .createHash("sha256")
    .update(compiler)
    .update(`\0ttsc@${ownPackageVersion()}`)
    // The emit policy decides the lowering, so it is part of the key: a cache
    // filled under an earlier policy must not answer for the current one.
    .update(`\0${ISOLATED_EMIT_ARGS.join("\0")}`)
    .update("\0isolated-source-map-v1\0")
    .update(filename)
    .update("\0" + format)
    .update("\0")
    .update(source)
    .digest("hex")
    .slice(0, 32);
  return {
    compiler,
    file: path.join(orphanCacheRoot(), `${key}.js`),
    signature,
    source,
  };
}

/**
 * Whether an orphan source held still from the read that keyed its cache entry
 * through the emit that lowered it: the same bytes, and the same metadata,
 * whose change time moves with every write even when the bytes return to what
 * they were.
 */
function orphanSourceHeld(
  filename: string,
  cache: { signature: string; source: Buffer },
): boolean {
  if (orphanSourceSignature(filename) !== cache.signature) return false;
  try {
    return fs.readFileSync(filename).equals(cache.source);
  } catch {
    return false;
  }
}

/** The metadata identity of an orphan source, or `undefined` when unreadable. */
function orphanSourceSignature(filename: string): string | undefined {
  try {
    const stat = fs.statSync(filename, { bigint: true });
    return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(
      ":",
    );
  } catch {
    return undefined;
  }
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

/**
 * The JavaScript an isolated single-file emit wrote for `input`, or `null`.
 *
 * With one input and no config, the compiler's source root is the input's own
 * directory, so the output sits at the input's name inside `outDir`. That is
 * the one file looked for; nothing else in the directory is an answer.
 */
function isolatedEmitOf(input: string, outDir: string): string | null {
  return new EmitOwnershipIndex({
    emitDir: outDir,
    rootDir: path.dirname(input),
  }).find(input);
}

/**
 * Make TypeScript-Go's CommonJS `export *` output visible to Node's
 * ESM-from-CJS named export scanner.
 *
 * Tsgo lowers star re-exports to `__exportStar(require("./x"), exports)`.
 * Runtime CommonJS consumers see the getters that helper installs, but Node's
 * ESM linker only exposes named imports it can statically identify from
 * `exports.name = ...` assignments. For relative star re-exports whose emitted
 * target is available, advertise its names through inert assignments that
 * Node's static lexer recognizes. The original helper still owns every runtime
 * binding, including values static discovery cannot enumerate.
 */
function exposeCommonJsStarExports(
  source: string,
  emittedFile: string | undefined,
  sourceFile: string | undefined,
): string {
  const parsed = parseCommonJsExports(source);
  const reserved = new Set(parsed.exports);
  const names = new Set<string>();
  for (const specifier of parsed.reexports) {
    for (const name of collectStarExportNames(
      emittedFile,
      sourceFile,
      specifier,
    )) {
      if (name !== "default" && name !== "__esModule" && !reserved.has(name)) {
        names.add(name);
      }
    }
  }
  if (names.size === 0) return source;
  // Node's lexer reads these assignments statically. Nothing executes, and no
  // existing statement, source position, control-flow body or runtime export
  // is changed. Keep all specifier/literal parsing in the same lexer Node uses.
  const hints = [...names]
    .map((name) => `exports[${JSON.stringify(name)}] = void 0;`)
    .join(" ");
  return source + `\nif (false) { ${hints} }\n`;
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
  const parsed = parseCommonJsExports(source);
  const names = new Set(parsed.exports);
  for (const specifier of parsed.reexports) {
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
  const parsed = parseCommonJsExports(source);
  const names = new Set(parsed.exports);
  for (const specifier of parsed.reexports) {
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

function resolveEmittedRequire(
  emittedFile: string,
  specifier: string,
): string | null {
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  const base = path.resolve(path.dirname(emittedFile), specifier);
  if (path.extname(base).length !== 0) {
    return RuntimeFilesystem.isFile(base) ? base : null;
  }
  for (const extension of [".js", ".cjs", ".mjs"] as const) {
    const candidate = base + extension;
    if (RuntimeFilesystem.isFile(candidate)) {
      return candidate;
    }
  }
  for (const extension of [".js", ".cjs", ".mjs"] as const) {
    const candidate = path.join(base, `index${extension}`);
    if (RuntimeFilesystem.isFile(candidate)) {
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
    if (RuntimeFilesystem.isFile(base)) return base;
    return (
      typescriptSourcesForJavaScriptSpecifier(base).find(
        RuntimeFilesystem.isFile,
      ) ?? null
    );
  }
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    const candidate = base + extension;
    if (RuntimeFilesystem.isFile(candidate)) {
      return candidate;
    }
  }
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (RuntimeFilesystem.isFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Serve the JavaScript a checked entry build emitted from `real`, or `null`
 * when no such build compiled it.
 *
 * The answer comes from the builds' ownership indexes, never from a shared
 * name. Once a build is proven to own the file its output must be there, so an
 * unreadable one is an error naming both files rather than a reason to try the
 * next lane and run something else.
 */
function serveEntryEmit(real: string): ServedSource | null {
  const owner = RuntimeManifestRegistry.findEntryEmit(real);
  if (owner === null) {
    return null;
  }
  return {
    emittedFile: owner.emittedFile,
    moduleOptions: owner.manifest.moduleOptions ?? {},
    source: readOwnedEmit(owner.emittedFile, real),
    sourceFile: real,
  };
}

/**
 * Serve `real` through the project that owns it, or `null` when no tsconfig
 * owns it or an emit-only root build of it failed; the caller then falls back
 * to the isolated emit.
 *
 * The project is built once per run, honouring its own tsconfig (transform
 * plugins included), so a source-shipping package that needs a transform
 * behaves correctly at runtime. That build serves the file when it compiled it.
 * When it did not — the file sits outside the project's `include` or `files` —
 * the file is a root no build covered, and it is compiled alone through the
 * same project's options rather than handed another file's output or stripped
 * of them.
 *
 * Whether that root is type-checked follows who wrote it. A file of the user's
 * own tree is checked, the same gate `ttsc/register` applies to every root it
 * prepares, so a type error stops the run before the file executes. A file
 * inside an installed package is emit-only, like every other file of that
 * package the project build already serves.
 */
function serveProjectEmit(real: string): ServedSource | null {
  const tsconfig = owningTsconfig(real);
  if (tsconfig === null) {
    return null;
  }
  let built: DependencyBuildGeneration.BuiltProject | null;
  try {
    built = ensureProjectBuilt(tsconfig);
  } catch {
    // The project's build produced nothing at all — a config that lists no
    // files emits nothing, for one. That says nothing about this file, which is
    // then a root like any other the build did not compile.
    built = null;
  }
  const served = built === null ? null : serveBuiltDependency(built, real);
  if (served !== null) {
    return served;
  }
  let root: DependencyBuildGeneration.BuiltProject;
  try {
    root = ensureRootBuilt(tsconfig, real);
  } catch (error) {
    // A checked root's failure is the run's type gate and stops it. An
    // emit-only root has no gate to report: its build failing (a read-only
    // install that refuses the synthesized config, say) leaves the file where
    // it stood before any project was consulted, the isolated emit.
    if (rootIsChecked(real)) throw error;
    return null;
  }
  const emitted = serveBuiltDependency(root, real);
  if (emitted === null) {
    throw new Error(
      `ttsx: the build of ${real} through ${tsconfig} emitted no JavaScript for it`,
    );
  }
  return emitted;
}

function serveBuiltDependency(
  built: DependencyBuildGeneration.BuiltProject,
  real: string,
): ServedSource | null {
  const emitted = builtProjectIndex(built).find(real);
  if (emitted === null) {
    return null;
  }
  return {
    emittedFile: emitted,
    moduleOptions: built.moduleOptions,
    source: readOwnedEmit(emitted, real),
    sourceFile: real,
  };
}

/** The ownership index of one dependency or root build, created on first use. */
function builtProjectIndex(
  built: DependencyBuildGeneration.BuiltProject,
): EmitOwnershipIndex {
  let index = builtProjectIndexes.get(built);
  if (index === undefined) {
    index = new EmitOwnershipIndex({
      emitDir: built.emitDir,
      outputs: built.outputs,
      rootDir: built.rootDir,
    });
    builtProjectIndexes.set(built, index);
  }
  return index;
}

const builtProjectIndexes = new WeakMap<
  DependencyBuildGeneration.BuiltProject,
  EmitOwnershipIndex
>();

/** Read an output a build is proven to have emitted from `source`. */
function readOwnedEmit(emittedFile: string, source: string): string {
  const text = readFileOrNull(emittedFile);
  if (text === null) {
    throw new Error(
      `ttsx: the JavaScript emitted for ${source} is missing: ${emittedFile}`,
    );
  }
  return text;
}

/**
 * Compile one root its owning project's file set does not contain, once per run
 * for each content of the root, and share the result across every process of
 * the run exactly like a project build. A failed check publishes nothing, so
 * every process that reaches the root reports the same diagnostics instead of
 * reusing a build.
 *
 * The root's own bytes are part of the key. A root is often a file the program
 * wrote itself, and one that rewrites it and loads it again, in this process or
 * another, must get the new code rather than the build of the old.
 */
function ensureRootBuilt(
  tsconfig: string,
  source: string,
): DependencyBuildGeneration.BuiltProject {
  const identity = `${source}\0${contentDigest(source)}`;
  const memo = `${tsconfig}\0${identity}`;
  const cached = builtRoots.get(memo);
  if (cached !== undefined) {
    return cached;
  }
  const failed = failedRoots.get(memo);
  if (failed !== undefined) {
    throw failed;
  }
  const { cacheDir, lockDir, metaPath, root } = dependencyCachePaths(
    tsconfig,
    identity,
  );
  const reuse = readDependencyCache(cacheDir, metaPath);
  if (reuse !== null) {
    builtRoots.set(memo, reuse);
    return reuse;
  }
  fs.mkdirSync(root, { recursive: true });
  let built: DependencyBuildGeneration.BuiltProject;
  try {
    built = withBuildLock(cacheDir, metaPath, lockDir, () =>
      buildRoot(tsconfig, source, cacheDir, metaPath),
    );
  } catch (error) {
    // The same content fails the same way, so a second reach of this root in
    // the process (a name scan, then the load) reports without building again.
    failedRoots.set(memo, error);
    throw error;
  }
  builtRoots.set(memo, built);
  return built;
}

const builtRoots = new Map<string, DependencyBuildGeneration.BuiltProject>();

/**
 * Roots whose build failed in this process, by the same key as
 * {@link builtRoots}.
 */
const failedRoots = new Map<string, unknown>();

/** SHA-256 of a file's bytes, or of nothing when it cannot be read. */
function contentDigest(file: string): string {
  const hash = crypto.createHash("sha256");
  try {
    hash.update(fs.readFileSync(file));
  } catch {
    // The build reports the unreadable file itself; the key only has to exist.
  }
  return hash.digest("hex");
}

/**
 * Compile `source` alone through the options of `tsconfig` into a fresh
 * generation directory, then publish its completion marker. The generation and
 * marker protocol is the project build's, so a reader never sees a partial
 * emit.
 */
function buildRoot(
  tsconfig: string,
  source: string,
  cacheDir: string,
  metaPath: string,
): DependencyBuildGeneration.BuiltProject {
  // Read through the descriptor-input recorder, so a plugin descriptor that
  // reaches this root reports the config chain it was compiled under.
  const project = readPluginDescriptorProjectConfig(tsconfig);
  const generation = DependencyBuildGeneration.newDependencyGeneration();
  const emitDir = DependencyBuildGeneration.dependencyGenerationDir(
    cacheDir,
    generation,
  );
  fs.rmSync(emitDir, { force: true, recursive: true });
  let built: ReturnType<typeof buildSingleRootProject>;
  try {
    built = buildSingleRootProject({
      checked: rootIsChecked(source),
      emitDir,
      key: `${process.pid}-${generation}`,
      options: { plugins: rootPluginPolicy() },
      projectRoot: project.root,
      role: "root",
      source,
      tsconfig,
    });
  } catch (error) {
    fs.rmSync(emitDir, { force: true, recursive: true });
    throw error;
  }
  const rootDir = DependencyBuildGeneration.resolvePhysicalPath(built.rootDir);
  const moduleOptions = projectModuleOptions(built.project.compilerOptions);
  const outputs = EmitOwnershipIndex.listOutputs(emitDir);
  publishDependencyMeta(metaPath, {
    generation,
    moduleOptions,
    outputs,
    rootDir,
  });
  return { emitDir, moduleOptions, outputs, rootDir };
}

/**
 * The plugin policy a root compiled at run time inherits: none while a plugin
 * descriptor is being loaded, because its own transform would re-enter plugin
 * loading, and none when the run itself disabled them (`ttsx --no-plugins`).
 */
function rootPluginPolicy(): false | undefined {
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1") return false;
  return RuntimeManifestRegistry.runtimeManifests().some(
    (manifest) => manifest.plugins === false,
  )
    ? false
    : undefined;
}

/**
 * Whether a root no build covered is type-checked before it runs.
 *
 * A root of the user's own tree is: it is the user's program. A root inside an
 * installed package is not, as no other file of that package is. Neither is a
 * root reached while a plugin descriptor is being loaded: the descriptor is
 * tooling the compiler runs, evaluated under the consumer's config, whose
 * `types`, `lib`, and strictness were never chosen for it, and it was never
 * type-gated before it ran.
 */
function rootIsChecked(real: string): boolean {
  return (
    process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD !== "1" &&
    !isInstalledPackageSource(real)
  );
}

/**
 * Whether `real` belongs to an installed package: its physical path passes
 * through a `node_modules` directory. A workspace package linked into
 * `node_modules` is not one, because its physical path is its own directory.
 */
function isInstalledPackageSource(real: string): boolean {
  return real
    .split(/[\\/]/)
    .some((segment) =>
      process.platform === "win32"
        ? segment.toLowerCase() === "node_modules"
        : segment === "node_modules",
    );
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
function ensureProjectBuilt(
  tsconfig: string,
): DependencyBuildGeneration.BuiltProject {
  const cached = builtProjects.get(tsconfig);
  if (cached !== undefined) {
    return cached;
  }
  const failed = failedProjects.get(tsconfig);
  if (failed !== undefined) {
    throw failed;
  }
  const { cacheDir, lockDir, metaPath, root } = dependencyCachePaths(tsconfig);

  const reuse = readDependencyCache(cacheDir, metaPath);
  if (reuse !== null) {
    builtProjects.set(tsconfig, reuse);
    return reuse;
  }

  fs.mkdirSync(root, { recursive: true });
  let built: DependencyBuildGeneration.BuiltProject;
  try {
    built = withBuildLock(cacheDir, metaPath, lockDir, () =>
      buildDependency(tsconfig, cacheDir, metaPath),
    );
  } catch (error) {
    // Every file the project owns asks for this build before its own root
    // lane, so a build that produced nothing would otherwise run again for
    // each of them. It is built once per process either way, like a success.
    failedProjects.set(tsconfig, error);
    throw error;
  }
  builtProjects.set(tsconfig, built);
  return built;
}

/**
 * Project builds that failed in this process, by tsconfig, the counterpart of
 * {@link builtProjects}.
 */
const failedProjects = new Map<string, unknown>();

interface DependencyCachePaths {
  /** Container of this dependency's generation-stamped emit directories. */
  cacheDir: string;
  /** Fenced cross-process coordination directory (`<key>.lock`). */
  lockDir: string;
  /** Atomic completion pointer (`<key>.json`) naming the live generation. */
  metaPath: string;
  root: string;
}

function dependencyCachePaths(
  tsconfig: string,
  rootSource?: string,
): DependencyCachePaths {
  const key = dependencyCacheKey(tsconfig, { root: rootSource });
  const root = dependencyCacheRoot();
  return {
    cacheDir: path.join(root, key),
    lockDir: path.join(root, `${key}.lock`),
    metaPath: path.join(root, `${key}.json`),
    root,
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
  build: () => DependencyBuildGeneration.BuiltProject,
): DependencyBuildGeneration.BuiltProject {
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
    const held = lease;
    return runHoldingLock(
      () => readDependencyCache(cacheDir, metaPath) ?? build(),
      () => releaseDependencyBuildLock(lockDir, held),
      // The runtime writes nothing of its own into the program's output; the
      // generation left held is reclaimed as abandoned once this process
      // exits.
      () => undefined,
    );
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
): DependencyBuildGeneration.BuiltProject {
  const project = readPluginDescriptorProjectConfig(tsconfig);
  const generation = DependencyBuildGeneration.newDependencyGeneration();
  const emitDir = DependencyBuildGeneration.dependencyGenerationDir(
    cacheDir,
    generation,
  );
  fs.rmSync(emitDir, { force: true, recursive: true });
  fs.mkdirSync(emitDir, { recursive: true });
  const result = runBuild({
    cwd: project.root,
    // Emit-only means diagnostics never withhold the emit, so a dependency's
    // own `noEmitOnError` is switched off: honoured, it would turn any
    // diagnostic into an empty output and the isolated fallback below.
    passthrough: [...runtimeCompilerArgs(project), "--noEmitOnError", "false"],
    emit: true,
    outDir: emitDir,
    // Every output this build writes stays in ttsx's private directory: a
    // declared `declarationDir`, `tsBuildInfoFile`, or `outFile`, and any
    // output location forwarded on the command line, would otherwise land in
    // the user's tree (samchon/ttsc#1404).
    isolateOutputsTo: emitDir,
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
  // Success is "the project wrote JavaScript", not the exit status: the build is
  // emit-only, so diagnostics do not fail it, and a native transform host
  // (typia, @ttsc/banner, …) writes its output on its own. A genuinely empty
  // output directory is the real failure; the caller then falls back to
  // isolated emit of the one file.
  if (!DependencyBuildGeneration.emittedAnything(emitDir)) {
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
  const outputs = EmitOwnershipIndex.listOutputs(emitDir);
  publishDependencyMeta(metaPath, {
    generation,
    moduleOptions,
    outputs,
    rootDir,
  });
  return { emitDir, moduleOptions, outputs, rootDir };
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
  meta: DependencyBuildGeneration.DependencyCacheMeta,
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

/** Outcome of one waiting session on another process's dependency build lock. */
type DependencyBuildWaitResult =
  | { outcome: "built"; built: DependencyBuildGeneration.BuiltProject }
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
        reason: `timed out after ${DependencyBuildLockProtocol.formatDuration(now - startedAt)}`,
        fence: lock.fence,
      };
    }
    sleepSync(DependencyBuildLockProtocol.DEP_BUILD_LOCK_POLL_MS);
  }
}

/** Owning-tsconfig cache keyed by directory, mirroring `packageTypeCache`. */
interface ITsconfigLookup {
  candidates: readonly string[];
  result: string | null;
}

/**
 * The config of the project that owns `real`: its nearest `tsconfig.json`, or,
 * when that config is a solution that does not contain the file, the referenced
 * project that does (samchon/ttsc#1406). `null` when no config owns the file at
 * all.
 */
function owningTsconfig(real: string): string | null {
  const nearest = nearestTsconfig(real);
  if (nearest === null) return null;
  const memo = `${nearest}\0${real}`;
  let owning = owningTsconfigCache.get(memo);
  if (owning === undefined) {
    owning = resolveOwningProjectConfig({
      file: real,
      onConfig: (config) => recordPluginDescriptorTsconfigCandidates([config]),
      tsconfig: nearest,
    });
    owningTsconfigCache.set(memo, owning);
  }
  return owning;
}

const owningTsconfigCache = new Map<string, string>();

const tsconfigCache = new Map<string, ITsconfigLookup>();

const moduleOptionsCache = new Map<string, OwningModuleOptions | null>();

/**
 * The nearest `tsconfig.json` at or above `file`'s directory, or `null`. The
 * walk stops at a `node_modules` boundary: a tsconfig above `node_modules`
 * belongs to the consumer, not to the published dependency inside it, so a
 * dependency that ships no tsconfig of its own has no owning project and is
 * compiled in isolation instead. A pnpm-symlinked workspace package is
 * unaffected because `file` is already its real path (outside `node_modules`).
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
    if (RuntimeFilesystem.isFile(candidate)) {
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
    if (RuntimeFilesystem.isFile(candidate)) return path.resolve(candidate);
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
 * The source-tree root a dependency's emit mirrors, in physical spelling.
 *
 * Both branches need the pass, for different reasons. A declared `rootDir`
 * arrives from `readProjectConfig` joined against the config that declared it
 * but never resolved, so a `rootDir` that is itself a symlinked directory stays
 * unresolved. `project.root` arrives through plain `fs.realpathSync`, which
 * follows reparse points but leaves a Windows 8.3 component alone — and
 * {@link realPath} uses `fs.realpathSync.native`, which expands it. The
 * ownership index resolves both sides itself, so a stale spelling cannot make
 * it answer wrongly, but a physical one keeps every lookup on its cheap forward
 * mirror instead of the inverse scan.
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
  return DependencyBuildGeneration.resolvePhysicalPath(
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
      if (RuntimeFilesystem.isFile(candidate)) {
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
    if (RuntimeFilesystem.isFile(candidate)) {
      return withSuffix(candidate);
    }
  }
  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (RuntimeFilesystem.isFile(candidate)) {
      return withSuffix(candidate);
    }
  }
  return null;
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
