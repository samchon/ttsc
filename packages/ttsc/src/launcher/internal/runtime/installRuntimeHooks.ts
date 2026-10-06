import crypto from "node:crypto";
import fs from "node:fs";
import {
  createRequire,
  isBuiltin,
  registerHooks,
  stripTypeScriptTypes,
} from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { EmitOwnershipIndex } from "../../../compiler/internal/EmitOwnershipIndex";
import { privateRuntimeRootDir } from "../../../compiler/internal/build/privateRuntimeRootDir";
import { runBuild } from "../../../compiler/internal/build/runBuild";
import { readProjectConfig } from "../../../compiler/internal/project/readProjectConfig";
import { resolveOwningProjectConfig } from "../../../compiler/internal/project/resolveOwningProjectConfig";
import { resolveTsgo } from "../../../compiler/internal/resolveTsgo";
import { spawnNative } from "../../../compiler/internal/spawnNative";
import { E2ETrace } from "../../../internal/E2ETrace";
import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { runtimeExecutableIdentity } from "../../../internal/runtimeExecutableIdentity";
import { moduleResolutionBaseSelects } from "../../../plugin/internal/load/moduleResolutionBaseSelects";
import { observeImportSearchRoots } from "../../../plugin/internal/load/observeImportSearchRoots";
import { visitImportMappedCandidates } from "../../../plugin/internal/load/visitImportMappedCandidates";
import { recordCacheFileUse } from "../../../plugin/internal/source/recordCacheFileUse";
import { buildSingleRootProject } from "../buildSingleRootProject";
import { inlineServedSourceMap } from "../inlineServedSourceMap";
import { parseCommonJsExports } from "../parseCommonJsExports";
import { runtimeCompilerArgs } from "../runtimeCompilerArgs";
import { CommonJsRuntimeSource } from "./CommonJsRuntimeSource";
import { DependencyBuildAdmission } from "./DependencyBuildAdmission";
import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import { OwnedProjectSource } from "./OwnedProjectSource";
import type { OwningModuleOptions } from "./OwningModuleOptions";
import { PluginDescriptorInputObservation } from "./PluginDescriptorInputObservation";
import type { ResolveResult } from "./ResolveResult";
import { RuntimeEmitProvenance } from "./RuntimeEmitProvenance";
import { RuntimeFilesystem } from "./RuntimeFilesystem";
import type { RuntimeHookOptions } from "./RuntimeHookOptions";
import { RuntimeIsolatedEmit } from "./RuntimeIsolatedEmit";
import { RuntimeLoaderCapabilities } from "./RuntimeLoaderCapabilities";
import type { RuntimeManifest } from "./RuntimeManifest";
import { RuntimeManifestRegistry } from "./RuntimeManifestRegistry";
import { RuntimeModuleFormat } from "./RuntimeModuleFormat";
import { checkNodeRuntimeSupport } from "./checkNodeRuntimeSupport";
import { commonJsImportFacade } from "./commonJsImportFacade";
import { dependencyCacheKey } from "./dependencyCacheKey";
import { dependencyCacheRoot } from "./dependencyCacheRoot";
import { projectModuleOptions } from "./projectModuleOptions";
import { readDependencyCache } from "./readDependencyCache";
import { realPath } from "./realPath";
import { restoreStrippedNodeBuiltinScheme } from "./restoreStrippedNodeBuiltinScheme";
import { selectRuntimePluginPolicy } from "./selectRuntimePluginPolicy";

/**
 * Install the source-loading hooks on the current (main) thread. Idempotent:
 * the preload on `NODE_OPTIONS` installs them in the entry process and in every
 * child process the program spawns, and `ttsc/register` may install them again
 * in a process that already has them.
 *
 * Prepared entries use their owner's build, including its selected transform
 * plugins, under source URLs so `__dirname`/`import.meta.url` keep source-tree
 * coordinates. Callback-prepared and direct prebuilt entry admission are
 * distinct from dependency builds and orphan recovery; this installer does not
 * certify that every dynamically loaded module has passed an entry type-check
 * gate. Three load paths:
 *
 * 1. A `.ts` belonging to the entry project: serve the pre-built emitted JS
 *    (transform plugins already applied) under the producer's captured physical
 *    source-to-written-output ownership.
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
 * Both graphs go through `registerHooks`, the supported customization API. A
 * CommonJS module an ESM `import` reaches may need an ESM facade that loads it
 * through the CommonJS loader (`commonJsImportFacade`): handed to the ESM
 * loader with source, the module's own `require()` bypasses the hooks on some
 * releases, so a nested `require("./x.js")` backed only by `x.ts` failed there.
 * Capability and entry predicates also admit direct CommonJS source lanes. One
 * reach the API lacks on some releases is `require.resolve`, which is probed
 * before installation. Served CommonJS bodies receive an owned require function
 * whose resolve member applies the same source policy on those releases. Its
 * copied extension registry advertises the supported source extensions; foreign
 * resolver methods and global extension registries are never replaced.
 *
 * Direct descriptor evaluation records user preloads after hook installation.
 * Only the generated CommonJS output sibling takes Node's native resolve/load
 * path; its synchronous bootstrap suspends recording of implementation imports.
 * This does not certify startup inputs read before the hooks were installed.
 *
 * @evidence contracts/common.md#principled-implementation Resolution preserves successful Node decisions, rescues source spellings only after documented resolution fails, and serves only outputs whose ownership index names the exact source. CommonJS facades delegate native evaluation and project detected own named exports under the selected namespace capability; an owned module-local require supplies source resolution when native require.resolve bypasses public hooks.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous hook owner coordinates source selection, emission ownership and descriptor observation; the entry, owning-project and orphan lanes remain explicit because they have distinct compilation premises. Private helpers carry those policies without a second foreign-resolver layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Public registerHooks handles resolution and loading; installation mutates neither Module._resolveFilename nor require.extensions. Source-extension recovery implements emitted-to-source spelling under the runtime contract, and module-local require adaptation addresses the probed public-hook difference without replacing Node methods.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe the three serving lanes, compile gates, source identity, capability-based local adaptation and extension-registry ownership; helper comments state ownership and failure effects with descriptive prose separated from tags.
 * @evidence contracts/portability.md#os-neutral-implementation Node URL conversion, native filesystem paths and physical resolution preserve OS spelling boundaries. Actual public-hook probes select runtime capabilities, native emit uses executable arguments without shell interpolation, and unresolved filesystem observation refuses reusable descriptor proof.
 * @evidence contracts/performance.md#efficient-algorithms Source ownership indexes replace repeated whole-emit scans with indexed source/native-identity queries. Export discovery processes source/emit bytes, reexport edges, native resolution and Set/name unions under traversal-local seen sets; separate roots can repeat traversal. Config-chain validation reads discovered inputs. Compiler identity brackets and streams executable bytes on valid lookups, refusing failed observations. Native build/name-scan/orphan paths add compilation, path/metadata/IO cost; recursive graphs remain subject to stack limits.
 * @evidence contracts/performance.md#reuse-equivalent-work Entry emits and dependency generations are shared within the current run; project/root keys include the same captured plugin policy compilation consumes, root keys also include source bytes, and orphan keys include source bytes, format, lowering policy and content-proven compiler identity. Nearest-config selection revalidates candidate existence. Project and failed-build memos still use a helper-instance module-evaluation snapshot and do not certify arbitrary mid-run config or dependency edits.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This installed helper retains hooks, callback and memoized module roles/builds, growing with distinct projects, roots and export scans without an eviction cap. Synchronous isolated output/publication staging paths attempt cleanup; failed native removal can propagate or add a causal cleanup error rather than certify release. WeakMap indexes do not independently retain their build keys. Node module caches and cross-process generations have their separate retention owners.
 */
export function installRuntimeHooks(options: RuntimeHookOptions = {}): void {
  if (options.prepareEntry !== undefined) {
    prepareRuntimeEntry = options.prepareEntry;
  }
  if (installed) {
    return;
  }
  assertNodeRuntimeSupport();
  // Probed before the runtime's hooks exist, so nothing the probes load is
  // served or recorded as an input of the program.
  nativeRequireResolveHooks =
    RuntimeLoaderCapabilities.requireResolveConsultsHooks();
  CommonJsRuntimeSource.configure(resolveCommonJsRequest, !nativeRequireResolveHooks);
  RuntimeLoaderCapabilities.commonJsNamespaceCarriesModuleExports();
  // Error stacks use the served source maps. This supported switch is applied
  // only after the required public loader capabilities have been established.
  if (typeof process.setSourceMapsEnabled === "function") {
    process.setSourceMapsEnabled(true);
  }
  registerHooks({ load, resolve });
  PluginDescriptorInputObservation.begin(true);
  installed = true;
}

/**
 * Actual public-hook coverage determines whether module-local resolve needs
 * adaptation.
 */
let nativeRequireResolveHooks = true;

/**
 * Preserve native resolution first and apply the existing source policy to an
 * owned require.
 */
function resolveCommonJsRequest(
  native: NodeJS.RequireResolve,
  specifier: string,
  options: { paths?: string[] } | undefined,
  filename: string,
): string {
  if (nativeRequireResolveHooks || typeof specifier !== "string")
    return native(specifier, options);
  const parents = path.isAbsolute(specifier)
    ? [undefined]
    : options?.paths === undefined
      ? [pathToFileURL(filename).href]
      : Array.isArray(options.paths) &&
          options.paths.every((entry) => typeof entry === "string")
        ? options.paths.map(
            (entry) =>
              pathToFileURL(path.join(path.resolve(entry), "index.js")).href,
          )
        : [];
  const observations = parents.map((parent) =>
    observePluginDescriptorResolutionCandidates(specifier, parent),
  );
  let selected: string | undefined;
  try {
    try {
      const resolved = native(specifier, options);
      if (path.isAbsolute(resolved)) selected = pathToFileURL(resolved).href;
      if (selected !== undefined)
        recordPluginDescriptorResolution(specifier, parents[0], selected);
      return resolved;
    } catch (error) {
      for (const parent of parents) {
        const rescued = probeRescuableSpecifier(specifier, parent);
        if (rescued === null) continue;
        selected = rescued;
        recordPluginDescriptorResolution(specifier, parent, rescued);
        return fileURLToPath(rescued);
      }
      throw error;
    }
  } finally {
    for (const observation of observations) observation.commit(selected);
  }
}

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
  /** Private observation of actual owning-config/build selection only. */
  selectedTsconfig?: string;
  buildScope?: string;
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

/** TypeScript URLs resolved at a JavaScript-to-TypeScript entry boundary. */
const runtimeEntryUrls = new Set<string>();

/**
 * The process entry, where Node's ESM loader opens it: resolved with no parent
 * and without the `require` condition, as an `--import` preload makes Node run
 * every entry. A CommonJS entry is handed to Node with its source rather than
 * as the facade, so Node loads it as the main module.
 */
const esmEntryUrls = new Set<string>();

/**
 * CommonJS modules the ESM loader evaluates from their source on a runtime
 * whose `require` is then Node's narrower one
 * (`RuntimeLoaderCapabilities.hookedCommonJsImportKeepsRequire`).
 */
const narrowRequireUrls = new Set<string>();

/**
 * Modules a {@link narrowRequireUrls} module asks for. That `require` loads
 * through the ESM loader and accepts only a module Node evaluates as CommonJS,
 * so a CommonJS module it asks for is handed to Node with its source, never as
 * the facade, which is an ES module.
 */
const narrowRequestedUrls = new Set<string>();

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
  // The generated file belongs to the evaluator. Other roots, including user
  // --import preloads, retain ordinary resolution and input observations.
  if (isDescriptorEvaluatorBootstrap(specifier))
    return nextResolve(specifier, context);
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
        restoreStrippedNodeBuiltinScheme(
          specifier,
          nextResolve(specifier, context),
        ),
        context,
      );
    } catch (error) {
      const rescued = probeRescuableSpecifier(specifier, context.parentURL);
      if (rescued === null) {
        throw error;
      }
      result = rememberRuntimeEntry(
        { shortCircuit: true, url: rescued },
        context,
      );
    }
    selected = result.url;
    recordPluginDescriptorResolution(specifier, context.parentURL, result.url);
    const moduleApi = CommonJsRuntimeSource.moduleSource();
    if (!nativeRequireResolveHooks && result.url === "node:module" && context.parentURL !== moduleApi.url && !isDescriptorEvaluatorBootstrap(context.parentURL ?? ""))
      return { shortCircuit: true, url: moduleApi.url };
    rememberCommonJsImportRole(result.url, context);
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
  // inputs, named once the resolution settles.
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
 * active for direct-evaluator user preloads after hook installation. The exact
 * generated evaluator entry bypasses these hooks and suspends recording only
 * while its synchronous implementation imports load; descriptor imports then
 * resume it.
 */
function recordPluginDescriptorResolution(
  specifier: string,
  parentURL: string | undefined,
  resolvedURL: string,
): void {
  if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return;
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
  const lines: string[] = [];
  const observe = (line: string | undefined): void => {
    if (line !== undefined) lines.push(line);
    else PluginDescriptorInputObservation.invalidate();
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
  PluginDescriptorInputObservation.record(lines);
  const out = process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT;
  if (out === undefined || out.length === 0) {
    PluginDescriptorInputObservation.invalidate();
    return;
  }
  try {
    fs.appendFileSync(out, lines.join(""), "utf8");
  } catch {
    PluginDescriptorInputObservation.invalidate();
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

/**
 * Record what a resolution that did not go through `require()` means for how a
 * CommonJS module it reaches is handed to Node: the process entry, or a module
 * a narrow `require` asked for ({@link narrowRequestedUrls}).
 */
function rememberCommonJsImportRole(
  url: string,
  context: ResolveContext,
): void {
  if (hasCondition(context, "require")) return;
  if (context.parentURL === undefined) esmEntryUrls.add(url);
  else if (narrowRequireUrls.has(context.parentURL))
    narrowRequestedUrls.add(url);
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

const commonJsNameScanSources = new Map<string, string | null>();

function load(
  url: string,
  context: LoadContext,
  nextLoad: NextLoad,
): LoadResult {
  const moduleApi = CommonJsRuntimeSource.moduleSource();
  if (url === moduleApi.url)
    return { shortCircuit: true, format: "module", source: moduleApi.source };
  // Preserve Node's file-entry evaluation without facade/export-name scans of
  // the owned bootstrap or observations of its temporary path and manifests.
  if (isDescriptorEvaluatorBootstrap(url)) return nextLoad(url, context);
  if (!url.startsWith("file:")) {
    return nextLoad(url, context);
  }
  const filename = fileURLToPath(url);
  if (!isTypeScriptSource(filename)) {
    return loadJavaScript(url, filename, context, nextLoad);
  }
  const served = resolveServedSource(
    filename,
    url,
    runtimeEntryUrls.delete(url) || isProcessEntry(filename),
  );
  const format = RuntimeModuleFormat.moduleFormat(
    filename,
    served.moduleOptions,
  );
  // An ESM import of a CommonJS source gets the facade, which loads the module
  // through the CommonJS loader, through the selected public CommonJS load boundary
  // (`commonJsImportFacade`); entry predicates can instead admit served source.
  if (format === "commonjs" && !hasCondition(context, "require")) {
    if (servesCommonJsFromSource(url)) {
      E2ETrace.runtimePreparation(
        served.source,
        filename,
        format,
        "ttsx-commonjs-source-import",
        {
          emittedFile: served.emittedFile,
          moduleOptions: served.moduleOptions,
          sourceFile: served.sourceFile,
          selectedTsconfig: served.selectedTsconfig,
          buildScope: served.buildScope,
        },
      );
      return {
        format,
        shortCircuit: true,
        source: CommonJsRuntimeSource.prepare(served.source, filename),
      };
    }
    return {
      format: "module",
      shortCircuit: true,
      source: commonJsImportFacade(
        url,
        filename,
        commonJsExportNames(
          served.source,
          served.emittedFile,
          served.sourceFile,
        ),
        RuntimeLoaderCapabilities.commonJsNamespaceCarriesModuleExports(),
      ),
    };
  }
  if (format === "commonjs")
    E2ETrace.runtimePreparation(
      served.source,
      filename,
      format,
      "ttsx-commonjs-source-load",
      {
        emittedFile: served.emittedFile,
        moduleOptions: served.moduleOptions,
        sourceFile: served.sourceFile,
        selectedTsconfig: served.selectedTsconfig,
        buildScope: served.buildScope,
      },
    );
  else if (process.env.TTSC_E2E_TRACE)
    E2ETrace.runtimePreparation(
      served.source,
      filename,
      format,
      "ttsx-esm-source-load",
      {
        emittedFile: served.emittedFile,
        moduleOptions: served.moduleOptions,
        sourceFile: served.sourceFile,
        selectedTsconfig: served.selectedTsconfig,
        buildScope: served.buildScope,
      },
    );
  return {
    format,
    shortCircuit: true,
    source:
      format === "commonjs"
        ? CommonJsRuntimeSource.prepare(served.source, filename)
        : served.source,
  };
}

/**
 * Load a JavaScript module, handing a CommonJS one an ESM import reaches to the
 * CommonJS loader through the facade where Node would otherwise evaluate it
 * with its narrower `require`. A runtime that gives a hook-served CommonJS
 * module that `require` gives it to every CommonJS module an import reaches
 * once any load hook exists, so without the facade such a module had no
 * `require.cache`, `require.extensions` or `require.resolve.paths`, and could
 * not `require()` a TypeScript source.
 */
function loadJavaScript(
  url: string,
  filename: string,
  context: LoadContext,
  nextLoad: NextLoad,
): LoadResult {
  const loaded = nextLoad(url, context);
  if (loaded.format !== "commonjs") return loaded;
  const source =
    typeof loaded.source === "string"
      ? loaded.source
      : loaded.source !== undefined && loaded.source !== null
        ? Buffer.from(loaded.source as Uint8Array).toString("utf8")
        : readFileOrNull(filename);
  if (source === null) return loaded;
  if (
    hasCondition(context, "require") ||
    RuntimeLoaderCapabilities.hookedCommonJsImportKeepsRequire() ||
    servesCommonJsFromSource(url)
  ) {
    const preparedSource = inlineServedSourceMap(source, filename, filename);
    E2ETrace.runtimePreparation(
      preparedSource,
      filename,
      loaded.format,
      "ttsx-commonjs-javascript-load",
    );
    return {
      ...loaded,
      shortCircuit: true,
      source: CommonJsRuntimeSource.prepare(preparedSource, filename),
    };
  }
  return {
    format: "module",
    shortCircuit: true,
    source: commonJsImportFacade(
      url,
      filename,
      javaScriptExportNames(filename, source),
      RuntimeLoaderCapabilities.commonJsNamespaceCarriesModuleExports(),
    ),
  };
}

/**
 * Whether a CommonJS module an ESM import reached is handed to Node with its
 * source rather than as the facade: the process entry, which Node then loads as
 * the main module, and a module a narrow `require` asked for. Where the source
 * gets Node's narrower `require`, the module is recorded, so a CommonJS module
 * it asks for is handed over the same way.
 */
function servesCommonJsFromSource(url: string): boolean {
  if (!esmEntryUrls.has(url) && !narrowRequestedUrls.has(url)) return false;
  if (!RuntimeLoaderCapabilities.hookedCommonJsImportKeepsRequire())
    narrowRequireUrls.add(url);
  return true;
}

/**
 * The names an ESM importer of a JavaScript CommonJS module sees besides
 * `default`, by Node's own static detection: the module's detected exports and
 * those of each re-exported `.js`, `.cjs` or served TypeScript module, resolved
 * as the module's own `require` resolves it.
 */
function javaScriptExportNames(filename: string, source: string): string[] {
  return [...collectJavaScriptExportNames(filename, source, new Set())];
}

function collectJavaScriptExportNames(
  filename: string,
  source: string,
  seen: Set<string>,
): Set<string> {
  const real = realPath(filename);
  if (seen.has(real)) return new Set();
  seen.add(real);
  const parsed = parseCommonJsExports(source);
  const names = new Set(parsed.exports);
  for (const specifier of parsed.reexports) {
    let target: string;
    try {
      target = createRequire(filename).resolve(specifier);
    } catch {
      continue;
    }
    if (!path.isAbsolute(target)) continue;
    let nested: Set<string>;
    if (isTypeScriptSource(target)) {
      nested = collectSourceCommonJsExportNames(target, new Set());
    } else if ([".js", ".cjs"].includes(path.extname(target))) {
      const text = readFileOrNull(target);
      if (text === null) continue;
      nested = collectJavaScriptExportNames(target, text, seen);
    } else {
      continue;
    }
    for (const name of nested) if (name !== "default") names.add(name);
  }
  return names;
}

/**
 * Whether a hook context carries `condition`. The conditions arrive as an array
 * on some releases and as a set on others.
 */
function hasCondition(
  context: ResolveContext | LoadContext,
  condition: string,
): boolean {
  for (const entry of context.conditions ?? [])
    if (entry === condition) return true;
  return false;
}

/**
 * Identify only the direct evaluator's generated CommonJS output sibling. The
 * parent supplies an absolute output under a canonical private directory; URL
 * conversion and native path resolution preserve that exact spelling. No
 * directory-wide exclusion or user preload/descriptor path is selected. This
 * comparison performs no filesystem read and retains no additional state.
 */
function isDescriptorEvaluatorBootstrap(value: string): boolean {
  const out = process.env.TTSC_PLUGIN_DESCRIPTOR_OUT;
  return (
    process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1" &&
    out !== undefined &&
    path.isAbsolute(out) &&
    runtimeFilePath(value) === path.resolve(`${out}.cjs`)
  );
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
  if (!project.configInputsComplete)
    PluginDescriptorInputObservation.invalidate();
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
    if (!candidate.configInputsComplete)
      PluginDescriptorInputObservation.invalidate();
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
      [
        requestedConfig,
        ...project.configPaths,
        ...(project.configInputs ?? []),
      ].map((file) => path.resolve(file)),
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
 * file, never from another file's output that shares its name. The lanes, in
 * order:
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
    RuntimeManifestRegistry.registerManifest(prepareEntry(real));
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
      recordCacheFileUse(cache.file);
      return hit;
    }
  }
  const outDir = createCanonicalTempDirectory("ttsx-orphan-");
  try {
    spawnNative(
      tsgo,
      RuntimeIsolatedEmit.compilerArgs(filename, outDir, format, "execution"),
      // The emit names its input by absolute path and reads no config, so it
      // runs from its own output directory rather than from a dependency's,
      // which below `node_modules` can pass Windows' MAX_PATH for a working
      // directory.
      { cwd: outDir, encoding: "utf8" },
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
    // and is not recorded.
    if (lowered !== null && cache !== null) {
      const sourceHeld = orphanSourceHeld(filename, cache);
      const currentCompiler = sourceHeld ? compilerIdentity(tsgo) : undefined;
      if (sourceHeld && currentCompiler === cache.compiler)
        writeOrphanCache(cache.file, lowered);
      E2ETrace.runtimePreparation("", filename, format, "orphan-cache-admission", {
        moduleOptions: null,
        emittedFile: emitted ?? undefined,
        orphanCache: {
          file: cache.file,
          sourceHeld,
          expectedCompiler: cache.compiler,
          currentCompiler,
        },
      });
    } else {
      E2ETrace.runtimePreparation("", filename, format, "orphan-cache-unavailable", {
        moduleOptions: null,
        emittedFile: emitted ?? undefined,
        orphanCache: {
          lowered: lowered !== null,
          cacheKeyAvailable: cache !== null,
        },
      });
    }
    return lowered;
  } catch (error) {
    if (error instanceof RuntimeEmitOwnershipError) throw error;
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
      RuntimeIsolatedEmit.compilerArgs(
        input,
        outDir,
        "commonjs",
        "export-scan",
      ),
      { cwd: outDir, encoding: "utf8" },
    );
    const emitted = isolatedEmitOf(input, outDir);
    const lowered = emitted === null ? null : readFileOrNull(emitted);
    commonJsNameScanSources.set(real, lowered);
    return lowered;
  } catch (error) {
    if (error instanceof RuntimeEmitOwnershipError) throw error;
    commonJsNameScanSources.set(real, null);
    return null;
  } finally {
    fs.rmSync(outDir, { force: true, recursive: true });
  }
}

/**
 * Cache root for lowered orphan sources.
 *
 * A run prepared by ttsx or `ttsc/register` names it in its manifest, under the
 * run's resolved cache root (`--cache-dir`, `TTSC_CACHE_DIR`, or the default
 * project-local root), where it outlives the run and is collected and cleaned
 * with the rest of that root. A runtime without a manifest has no cache root to
 * name, so its lowerings go where its dependency builds go
 * (`dependencyCacheRoot`), which is removed with the evaluation or the process
 * that made them.
 */
function orphanCacheRoot(): string {
  const owner = RuntimeManifestRegistry.runtimeManifests().find(
    (candidate) =>
      typeof candidate.orphanCacheDir === "string" &&
      candidate.orphanCacheDir.length !== 0,
  );
  return owner !== undefined
    ? owner.orphanCacheDir!
    : path.join(dependencyCacheRoot(), "orphan");
}

/**
 * Content-proven identity of the compiler executable. Unreadable or unstable
 * executable bytes produce a new nonce, so no previous generation can answer
 * for an executable whose identity could not be established.
 *
 * Read afresh at every use, never remembered by path: a long-lived process can
 * lower orphans before and after the compiler at that path is replaced, and an
 * entry lowered by the new one must not be recorded under the old one's key for
 * a later process to adopt.
 */
function compilerIdentity(binary: string): string {
  return runtimeExecutableIdentity(binary) ?? crypto.randomUUID();
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
 * The cache outlives the run in its cache root, so a hit has to prove the
 * current inputs would produce the cached text. The key holds everything that
 * decides it: the source's bytes and path (the inlined map names the path), the
 * module format, the emit arguments, the compiler that lowers it, and the ttsc
 * that post-processes it. The compiler is keyed by what it is, not where it is:
 * a flat `node_modules` upgrade replaces the binary at the same path, and a key
 * of the path alone kept serving the old compiler's output.
 *
 * The source is read here, and the emit reads it again. The answer carries the
 * bytes and the file's metadata before they were read, so `orphanSourceHeld`
 * can prove the emit read the same source.
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
    .update(`\0${RuntimeIsolatedEmit.policyKey()}`)
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
  const tmp = `${cacheFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(tmp, lowered);
    fs.renameSync(tmp, cacheFile);
  } catch (error) {
    E2ETrace.runtimePreparation("", cacheFile, "unconsumed", "orphan-cache-write-failed", {
      moduleOptions: null,
      orphanCache: { file: cacheFile, error: String(error) },
    });
    // ignore — caching is an optimization, correctness does not depend on it
  } finally {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Cache admission remains optional when the filesystem denies cleanup.
    }
  }
}

/**
 * The JavaScript an isolated single-file emit wrote for `input`, or `null`.
 *
 * Both callers pass exactly one positional source with ignoreConfig, noResolve
 * and isolatedModules to a compiler without plugin injection. Their freshly
 * acquired private directory contains no earlier JavaScript. The actual
 * completed output population therefore belongs to that source, independently
 * of filename or extension priority. A declaration-only input may emit none;
 * multiple executable outputs contradict this protocol and are an error.
 */
function isolatedEmitOf(input: string, outDir: string): string | null {
  const outputs = EmitOwnershipIndex.listOutputs(outDir);
  if (outputs.length === 0) return null;
  if (outputs.length !== 1) {
    throw new RuntimeEmitOwnershipError(
      `ttsx: isolated emit of ${input} produced ${outputs.length} executable outputs; single-input ownership cannot be established`,
    );
  }
  return path.resolve(outDir, outputs[0]!);
}

/** A violated single-input emit authority cannot use the type-strip fallback. */
class RuntimeEmitOwnershipError extends Error {}

/**
 * The names an ESM importer of a served CommonJS module sees besides `default`,
 * by Node's own static detection (`cjs-module-lexer`, the lexer Node runs): the
 * module's detected exports, and the names of each star re-export's target.
 *
 * Tsgo lowers `export *` to `__exportStar(require("./x"), exports)`, whose
 * target Node would lex from disk, where only `x.ts` exists. The target's names
 * are therefore read from its emit, or from the source's own name scan, as Node
 * would read them had the emitted file been there. The helper still owns every
 * runtime binding.
 */
function commonJsExportNames(
  source: string,
  emittedFile: string | undefined,
  sourceFile: string | undefined,
): string[] {
  const parsed = parseCommonJsExports(source);
  const names = new Set(parsed.exports);
  for (const specifier of parsed.reexports) {
    for (const name of collectStarExportNames(
      emittedFile,
      sourceFile,
      specifier,
    )) {
      if (name !== "default" && name !== "__esModule") names.add(name);
    }
  }
  return [...names];
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
 * owns it. An empty project emit can leave this file outside its root set;
 * other project or root failures retain their original diagnostic instead of
 * silently discarding the project's compiler and plugin policy.
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
  const operations = {
    owningTsconfig,
    ensureProjectBuilt,
    isEmptyProjectEmitError: (error: unknown) =>
      error instanceof EmptyProjectEmitError,
    serve: serveBuiltDependency,
    ensureRootBuilt,
  };
  if (!process.env.TTSC_E2E_TRACE)
    return OwnedProjectSource.serve(real, operations);
  let selectedTsconfig: string | undefined;
  let buildScope: string | undefined;
  const served = OwnedProjectSource.serve(real, {
    ...operations,
    owningTsconfig(source) {
      const selected = owningTsconfig(source);
      selectedTsconfig = selected ?? undefined;
      return selected;
    },
    ensureProjectBuilt(config) {
      buildScope = "project";
      return ensureProjectBuilt(config);
    },
    ensureRootBuilt(config, source) {
      buildScope = "single-root";
      return ensureRootBuilt(config, source);
    },
  });
  return served === null ? null : { ...served, selectedTsconfig, buildScope };
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
      emittedSources: built.emittedSources,
      emittedSourceProofFailures: built.emittedSourceProofFailures,
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
  const { cacheDir, lockDir, metaPath, root, compilerProof, plugins } =
    dependencyCachePaths(tsconfig, identity);
  const memo = cacheDir;
  const cached = builtRoots.get(memo);
  if (cached !== undefined) {
    return cached;
  }
  const failed = failedRoots.get(memo);
  if (failed !== undefined) {
    throw failed;
  }
  const reuse = readDependencyCache(cacheDir, metaPath);
  if (reuse !== null) {
    builtRoots.set(memo, reuse);
    return reuse;
  }
  fs.mkdirSync(root, { recursive: true });
  let built: DependencyBuildGeneration.BuiltProject;
  try {
    built = DependencyBuildAdmission.run(cacheDir, metaPath, lockDir, () =>
      buildRoot(tsconfig, source, cacheDir, metaPath, compilerProof, plugins),
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
  compilerProof?: string,
  plugins?: false,
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
  try {
    const built = buildSingleRootProject({
      checked: rootIsChecked(source),
      emitDir,
      key: `${process.pid}-${generation}`,
      options: { plugins },
      projectRoot: project.root,
      role: "root",
      source,
      tsconfig,
    });
    const rootDir = DependencyBuildGeneration.resolvePhysicalPath(
      built.rootDir,
    );
    const moduleOptions = projectModuleOptions(built.project.compilerOptions);
    const outputs = EmitOwnershipIndex.listOutputs(emitDir);
    const emittedSources = built.emittedSources;
    const emittedSourceProofFailures = built.emittedSourceProofFailures;
    if (!RuntimeEmitProvenance.isRecord(emittedSources)) {
      throw new Error(
        `ttsx: root build of ${source} did not report authoritative emit provenance`,
      );
    }
    assertCompilerStillCurrent(tsconfig, compilerProof);
    publishDependencyMeta(metaPath, {
      generation,
      moduleOptions,
      outputs,
      rootDir,
      emittedSources,
      emittedSourceProofFailures,
    });
    return {
      emitDir,
      moduleOptions,
      outputs,
      rootDir,
      emittedSources,
      emittedSourceProofFailures,
    };
  } catch (error) {
    throwAfterFailedArtifactCleanup(error, emitDir, true);
  }
}

/**
 * The plugin policy a project or root compiled at run time inherits: none while
 * a plugin descriptor is being loaded, because its own transform would re-enter
 * plugin loading, and none when the run itself disabled them (`ttsx
 * --no-plugins`).
 */
function runtimePluginPolicy(): false | undefined {
  return selectRuntimePluginPolicy(
    RuntimeManifestRegistry.runtimeManifests(),
    process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1",
  );
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
  const { cacheDir, lockDir, metaPath, root, compilerProof, plugins } =
    dependencyCachePaths(tsconfig);
  const cached = builtProjects.get(cacheDir);
  if (cached !== undefined) {
    return cached;
  }
  const failed = failedProjects.get(cacheDir);
  if (failed !== undefined) {
    throw failed;
  }

  const reuse = readDependencyCache(cacheDir, metaPath);
  if (reuse !== null) {
    builtProjects.set(cacheDir, reuse);
    return reuse;
  }

  fs.mkdirSync(root, { recursive: true });
  let built: DependencyBuildGeneration.BuiltProject;
  try {
    built = DependencyBuildAdmission.run(cacheDir, metaPath, lockDir, () =>
      buildDependency(tsconfig, cacheDir, metaPath, compilerProof, plugins),
    );
  } catch (error) {
    // Every file the project owns asks for this build before its own root
    // lane, so a build that produced nothing would otherwise run again for
    // each of them. It is built once per process either way, like a success.
    failedProjects.set(cacheDir, error);
    throw error;
  }
  builtProjects.set(cacheDir, built);
  return built;
}

/**
 * Project builds that failed in this process, by full cache identity, paired
 * with {@link builtProjects}.
 */
const failedProjects = new Map<string, unknown>();

interface DependencyCachePaths {
  /** Container of this dependency's generation-stamped emit directories. */
  cacheDir: string;

  /** Fenced cross-process coordination directory (`<key>.lock`). */
  lockDir: string;

  /** Atomic completion pointer (`<key>.json`) naming the live generation. */
  metaPath: string;

  /** Executable content proof whose key must still hold before publication. */
  compilerProof?: string;

  /** Plugin policy captured once for both cache addressing and compilation. */
  plugins?: false;

  root: string;
}

function dependencyCachePaths(
  tsconfig: string,
  rootSource?: string,
): DependencyCachePaths {
  let compilerProof: string | undefined;
  try {
    compilerProof = runtimeExecutableIdentity(
      resolveTsgo({ cwd: path.dirname(tsconfig) }).binary,
    );
  } catch {
    // An unobservable executable gets a unique, non-reusable generation key.
  }
  const plugins = runtimePluginPolicy();
  const key = dependencyCacheKey(tsconfig, {
    root: rootSource,
    compilerIdentity: compilerProof ?? crypto.randomUUID(),
    plugins,
  });
  const root = dependencyCacheRoot();
  return {
    cacheDir: path.join(root, key),
    lockDir: path.join(root, `${key}.lock`),
    metaPath: path.join(root, `${key}.json`),
    compilerProof,
    plugins,
    root,
  };
}

/** A runtime build may publish only under the compiler content that keyed it. */
function assertCompilerStillCurrent(tsconfig: string, proof?: string): void {
  if (proof === undefined) return;
  const current = runtimeExecutableIdentity(
    resolveTsgo({ cwd: path.dirname(tsconfig) }).binary,
  );
  if (current !== proof) {
    throw new Error(
      `ttsx: compiler changed while building ${tsconfig}; the runtime generation was not published`,
    );
  }
}

/**
 * Compile a dependency project into a fresh generation directory and publish
 * its completion marker atomically.
 *
 * Under cooperative cache ownership and noncolliding generation ids, emit lands
 * in a fresh `<cacheDir>/gen-<generation>` rather than replacing a reader's
 * generation in place. Emit presence and provenance are checked before
 * temp-and-rename publication. Failure attempts to remove the partial
 * directory; refused cleanup can leave it behind without publishing a
 * successful marker.
 */
function buildDependency(
  tsconfig: string,
  cacheDir: string,
  metaPath: string,
  compilerProof?: string,
  plugins?: false,
): DependencyBuildGeneration.BuiltProject {
  const project = readPluginDescriptorProjectConfig(tsconfig);
  const generation = DependencyBuildGeneration.newDependencyGeneration();
  const emitDir = DependencyBuildGeneration.dependencyGenerationDir(
    cacheDir,
    generation,
  );
  fs.rmSync(emitDir, { force: true, recursive: true });
  try {
    fs.mkdirSync(emitDir, { recursive: true });
    const result = runBuild({
      cwd: project.root,
      forceEmitProvenance: true,
      // Emit-only means diagnostics never withhold the emit, so a dependency's
      // own `noEmitOnError` is switched off: honoured, it would turn any
      // diagnostic into an empty output and the isolated fallback below.
      passthrough: [
        ...runtimeCompilerArgs(project),
        "--noEmitOnError",
        "false",
      ],
      emit: true,
      outDir: emitDir,
      // Every output this build writes stays in ttsx's private directory: a
      // declared `declarationDir`, `tsBuildInfoFile`, or `outFile`, and any
      // output location forwarded on the command line, would otherwise land in
      // the user's tree.
      isolateOutputsTo: emitDir,
      // The generation directory is an `outDir` this lane injected, not one the
      // dependency declared. Private ordinary emit uses a volume-root layout
      // without restricting imported sources to the config directory; declared
      // and composite roots keep their compiler containment policy. The same
      // root is published by resolveDependencySourceRoot below.
      pinInferredRootDir: true,
      // Compiler containment uses the same lexical spelling as its inputs;
      // resolveDependencySourceRoot separately owns physical serving lookup.
      privateEmitRootDir: privateRuntimeRootDir(
        project.root,
        project.compilerOptions.rootDir,
        project.compilerOptions.composite,
      ),
      // Emit a source map on the transient dependency emit (it never reaches the
      // dependency's published `lib/`) so the serve path can inline it under the
      // source URL, but only when the dependency configures none itself. Routed
      // as a dedicated build option, not a forwarded tsgo flag, so it never
      // reaches a native plugin host's argument parser.
      forceRuntimeSourceMap:
        project.compilerOptions.sourceMap !== true &&
        project.compilerOptions.inlineSourceMap !== true,
      // Honour the dependency's own transform plugins: a source-shipping package
      // can itself depend on a transform (e.g. a fixture whose values are built
      // with `typia.createRandom`), and its runtime behaviour is wrong without it.
      // `runBuild` runs on this main thread, so its plugin resolution works the
      // same as the entry build's. A run started with `--no-plugins` keeps that
      // disabled policy across dependency projects. Loading a plugin descriptor
      // (`TTSC_PLUGIN_DESCRIPTOR_LOAD`) also disables plugins: its own — possibly
      // self-hosting — transform must NOT run, or it re-enters plugin loading and
      // deadlocks, so every dependency in that graph builds with plugins off.
      plugins,
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
      E2ETrace.runtimePreparation(
        "",
        tsconfig,
        "unconsumed",
        "dependency-project-empty-emit",
        {
          moduleOptions: projectModuleOptions(project.compilerOptions),
          selectedTsconfig: tsconfig,
          buildScope: "project",
          nativeBuildFailure: {
            status: result.status,
            stdout: result.stdout,
            stderr: result.stderr,
          },
        },
      );
      throw new EmptyProjectEmitError(
        [
          `ttsx: dependency build produced no output for ${tsconfig}`,
          result.stderr || result.stdout,
        ]
          .filter((line) => line.trim().length !== 0)
          .join("\n"),
      );
    }
    // Absence above serves and publishes nothing. Every actual emitted byte
    // still requires the selected producer's authoritative ownership record.
    const emittedSources = result.emittedSources;
    const emittedSourceProofFailures = result.emittedSourceProofFailures;
    if (!RuntimeEmitProvenance.isRecord(emittedSources)) {
      throw new Error(
        `ttsx: dependency build of ${tsconfig} did not report authoritative emit provenance`,
        { cause: result },
      );
    }
    const rootDir = resolveDependencySourceRoot(project);
    const moduleOptions = projectModuleOptions(project.compilerOptions);
    const outputs = EmitOwnershipIndex.listOutputs(emitDir);
    assertCompilerStillCurrent(tsconfig, compilerProof);
    publishDependencyMeta(metaPath, {
      generation,
      moduleOptions,
      outputs,
      rootDir,
      emittedSources,
      emittedSourceProofFailures,
    });
    return {
      emitDir,
      moduleOptions,
      outputs,
      rootDir,
      emittedSources,
      emittedSourceProofFailures,
    };
  } catch (error) {
    throwAfterFailedArtifactCleanup(error, emitDir, true);
  }
}

/**
 * Publish the completion marker atomically: write it to a private temp name in
 * the same directory, then rename onto `metaPath`. Successful native rename
 * replaces the whole marker rather than writing it in place; refusal propagates
 * with an attempted temporary-file cleanup. The producer calls this after emit
 * presence and provenance checks. Stable layout and retained immutable emit
 * remain cooperative premises, and no fsync establishes crash durability.
 */
function publishDependencyMeta(
  metaPath: string,
  meta: DependencyBuildGeneration.DependencyCacheMeta,
): void {
  const tmp = `${metaPath}.${process.pid}.${Date.now()}.${crypto
    .randomBytes(6)
    .toString("hex")}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(meta), "utf8");
    fs.renameSync(tmp, metaPath);
  } catch (error) {
    throwAfterFailedArtifactCleanup(error, tmp, false);
  }
}

/**
 * Remove only the artifact owned by the failed publication. Preserve its
 * original failure; a refused removal adds a second causal outcome rather than
 * replacing the compiler or marker error with a filesystem error.
 */
function throwAfterFailedArtifactCleanup(
  error: unknown,
  location: string,
  recursive: boolean,
): never {
  try {
    fs.rmSync(location, { force: true, recursive });
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      `ttsx: publication failed and its private artifact could not be removed: ${location}`,
      { cause: error },
    );
  }
  throw error;
}

/**
 * A complete project build with no JavaScript does not establish root
 * ownership.
 */
class EmptyProjectEmitError extends Error {}

/** Owning-tsconfig cache keyed by directory, mirroring `packageTypeCache`. */
interface ITsconfigLookup {
  candidates: readonly string[];
  result: string | null;
}

/**
 * The config of the project that owns `real`: its nearest `tsconfig.json`, or,
 * when that config is a solution that does not contain the file, the referenced
 * project that does. `null` when no config owns the file at all.
 */
function owningTsconfig(real: string): string | null {
  const nearest = nearestTsconfig(real);
  if (nearest === null) return null;
  // Config spelling and target identity do not prove that inherited options,
  // reference roots or directory membership are unchanged. The resolver owns
  // lookup-scoped reuse; a later import must ask it for a current answer.
  return resolveOwningProjectConfig({
    file: real,
    onConfig: (config) => recordPluginDescriptorTsconfigCandidates([config]),
    tsconfig: nearest,
  });
}

const tsconfigCache = new Map<string, ITsconfigLookup>();

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
 * The private layout root a dependency's emit mirrors, in physical spelling.
 * Ordinary undeclared roots use the volume root, while declared and composite
 * roots retain their compiler containment. Argument composition and serving
 * metadata use the same selection; the output ledger proves source ownership.
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
 * The entry lane applies the same private-root policy and physical-resolution
 * pass. Volume roots do not enumerate or authorize other source files.
 */
function resolveDependencySourceRoot(
  project: ReturnType<typeof readProjectConfig>,
): string {
  const rootDir = project.compilerOptions.rootDir;
  return DependencyBuildGeneration.resolvePhysicalPath(
    privateRuntimeRootDir(
      project.root,
      rootDir,
      project.compilerOptions.composite,
    ),
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
