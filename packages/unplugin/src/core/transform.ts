import { type ChildProcess, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  ITtscCompilerDiagnostic,
  ITtscCompilerTransformation,
} from "ttsc";
import { TtscCompiler } from "ttsc";
import {
  type FilesystemPathIdentityContext,
  type FilesystemPathIdentityOperations,
  createFilesystemPathIdentityContext,
} from "ttsc/path-identity";
import type { TransformResult } from "unplugin";

import type { ResolvedTtscUnpluginOptions } from "./options";
import {
  absolutizePathsTarget,
  readEffectiveTsconfigPaths,
} from "./tsconfigPaths";

/**
 * The normalised transform result type that this module produces.
 *
 * Excludes the shorthand `string`, `null`, and `undefined` variants of
 * unplugin's `TransformResult` so callers always receive an object or
 * `undefined`.
 */
export type TtscTransformResult = Exclude<
  TransformResult,
  string | null | undefined
>;

/**
 * Normalised alias entry used when building the `paths` overlay for the
 * generated tsconfig. Derived from either a Vite array alias or a webpack/
 * Rspack object alias.
 */
export interface TtscTransformAlias {
  /** The alias key (module specifier prefix). */
  find: string;
  /** Absolute or cwd-relative path that the alias points to. */
  replacement: string;
}

/** One directory's cheap project-membership identity at generation time. */
interface TtscProjectDirectorySnapshot {
  /** Absolute directory spelling used by the project walk. */
  path: string;
  /** Metadata signature that changes when its immediate membership changes. */
  signature: string;
}

/** Generation-scoped directory watchers used to detect membership changes. */
interface TtscProjectMutationTracker {
  close: () => void;
  failed: boolean;
  membershipChanged: boolean;
  settle?: Promise<void>;
}

/**
 * A single entry in the project transform cache.
 *
 * Stores the full compiler result together with SHA-256 hashes of every project
 * input file. In a cache with an explicit build lifecycle, the first delivery
 * of each compiled module compares its supplied source with the generation
 * snapshot in constant time. Later graph-bearing deliveries validate only the
 * requested file's derived inputs plus exact host descriptor/config inputs;
 * graph-free envelopes retain complete-snapshot validation.
 */
export interface TtscCachedProjectTransform {
  /**
   * SHA-256 hash of every input the compiler reported outside the project walk
   * (keyed by filesystem identity), captured at the time of the transform.
   *
   * The project walk cannot see files outside the project root or under ignored
   * directories (`node_modules` declarations, monorepo sibling sources,
   * out-of-root tsconfig `extends` ancestry), yet the host-owned reference
   * graph proves they are transform inputs. Long-lived hosts that never clear
   * the cache between builds (Metro workers and the Turbopack loader) would
   * otherwise replay a project transform computed against a stale out-of-walk
   * input for the whole process lifetime; per-build hosts clear the cache on
   * `buildStart` and never replay across edits.
   */
  externalInputHashes?: Record<string, string>;
  /**
   * Compiler-time physical identities for graph-owned entries in
   * {@link externalInputHashes}. Dependency-only paths have no generation
   * realpath protocol and therefore omit this evidence.
   */
  externalInputRealpaths?: Record<string, string | null>;
  /**
   * Original absolute spellings of {@link externalInputHashes} inputs. These
   * stay separate from their identity keys so validation reads the paths the
   * compiler reported rather than a normalized replacement spelling.
   */
  externalInputPaths?: string[];
  /**
   * Metadata signature of each out-of-walk input, captured around the read that
   * proved its {@link externalInputHashes} entry. An input whose signature still
   * holds carries the recorded content, so revalidation may skip the read.
   *
   * Keyed by lexical spelling rather than by physical identity, for the reason
   * {@link TtscHostInputValidation} states: a symlink or junction spelling and
   * its selected target deliberately share one identity but have different
   * metadata, so an identity key would let the two overwrite each other's
   * signature and force both to be re-read on every delivery.
   */
  externalInputSignatures?: Record<string, string>;
  /**
   * SHA-256 hash of each project-relative input path at the time of the
   * transform.
   */
  inputHashes: Record<string, string>;
  /**
   * Metadata signature of each {@link inputHashes} entry whose hash was proven
   * against an unracing read of the file on disk. The generation's own current
   * file is deliberately absent: its recorded hash comes from the bundler's
   * in-memory source, which no disk signature can stand for.
   */
  inputSignatures?: Record<string, string>;
  /** Metadata snapshot of every directory in the stable generation walk. */
  projectDirectories?: TtscProjectDirectorySnapshot[];
  /** Live notification state for universal host-input changes. */
  hostInputMutationTracker?: TtscProjectMutationTracker;
  /** Live notification state for file/directory creation, deletion, and rename. */
  projectMutationTracker?: TtscProjectMutationTracker;
  /**
   * Whether the generation-time project walk observed every directory and file
   * it attempted to snapshot. An incomplete walk may never authorize narrow
   * validation; a later complete walk must be allowed to replace it.
   */
  projectSnapshotComplete?: boolean;
  /** Absolute path to the directory that owns the tsconfig. */
  projectRoot: string;
  /** Raw compiler output returned by {@link TtscCompiler.transform}. */
  result: ITtscCompilerTransformation;
  /**
   * Files already delivered from this generation, keyed by filesystem identity.
   * Build-scoped caches use this to skip persistent validation only for a
   * module's first delivery inside the current build.
   */
  servedFiles?: Set<string>;
  /**
   * Absolute path of the generated temp-dir tsconfig this compile ran against,
   * when an alias/compiler-options overlay required one. The compiler reports
   * it in the envelope's `graph.configs` chain, but it is disposed right after
   * the compile, so registering it as a watch input would invalidate every
   * bundler cache snapshot on the next build; watch derivation must skip
   * exactly this path.
   */
  temporaryTsconfig?: string;
}

/**
 * Keyed by a stable JSON string that encodes the tsconfig path, compiler
 * options overlay, plugin list, and alias paths. The value is a `Promise` so
 * concurrent transforms for the same project share a single in-flight
 * compilation rather than spawning multiple `TtscCompiler` instances.
 */
export type TtscTransformCache = Map<
  string,
  Promise<TtscCachedProjectTransform>
>;

/** Cache-owned synchronous filesystem reads used by transform validation. */
export interface TtscTransformFilesystemOperations {
  /** Override the case policy when the observed filesystem is not the host. */
  caseSensitive?: FilesystemPathIdentityOperations["caseSensitive"];
  /** Test whether a validation or resolution candidate currently exists. */
  exists(location: string): boolean;
  /** Read link metadata without following a symbolic link. */
  lstat(location: string): fs.BigIntStats;
  /** Read bytes used by project, graph, and host-input fingerprints. */
  readFile(location: string): Buffer;
  /** Enumerate one project or missing-input proof directory. */
  readdir(location: string): fs.Dirent[];
  /** Resolve one lexical path to its current physical target. */
  realpath(location: string): string;
  /** Read ordinary metadata for file-kind and missing-path checks. */
  stat(location: string): fs.Stats;
  /** Read nanosecond metadata for stable file and directory signatures. */
  statBigInt(location: string): fs.BigIntStats;
  /** Override path parsing when the observed filesystem is not the host. */
  platform?: NodeJS.Platform;
  /**
   * Open one directory's change notification, or throw when the observed
   * filesystem cannot provide one.
   *
   * Left undefined, generations watch the host filesystem: `fs.watch` on POSIX
   * and an isolated broker process on Windows. An embedder observing another
   * filesystem supplies its own; a generation whose watch cannot be opened
   * keeps validating from recorded state instead of losing its cache.
   */
  watch?(
    directory: string,
    listener: (eventType: string, filename: string | null) => void,
    onError: () => void,
  ): { close: () => void };
}

const DEFAULT_FILESYSTEM_OPERATIONS: TtscTransformFilesystemOperations =
  Object.freeze({
    exists: fs.existsSync,
    lstat: (location: string) => fs.lstatSync(location, { bigint: true }),
    readFile: (location: string) => fs.readFileSync(location),
    readdir: (location: string) =>
      fs.readdirSync(location, { withFileTypes: true }),
    realpath: fs.realpathSync.native,
    stat: fs.statSync,
    statBigInt: (location: string) => fs.statSync(location, { bigint: true }),
  });

const TRANSFORM_CACHE_FILESYSTEM = new WeakMap<
  TtscTransformCache,
  TtscTransformFilesystemOperations
>();
const TRANSFORM_RESULT_FILESYSTEM = new WeakMap<
  ITtscCompilerTransformation,
  TtscTransformFilesystemOperations
>();

/**
 * Caches whose owner has declared a real per-build lifecycle by calling
 * {@link beginTtscTransformBuild} before transforms begin.
 */
const BUILD_SCOPED_TRANSFORM_CACHES = new WeakSet<TtscTransformCache>();

function createHostPathIdentityContext(
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): FilesystemPathIdentityContext {
  return createFilesystemPathIdentityContext({
    caseSensitive: filesystem.caseSensitive,
    lstat: filesystem.lstat,
    platform: filesystem.platform,
    readdir: (directory) =>
      filesystem.readdir(directory).map((entry) => entry.name),
    realpath: filesystem.realpath,
    throwOnRealpathError: false,
  });
}

/** Normalize one directory entry under the owning filesystem's case policy. */
export function normalizeHostInputName(
  name: string,
  caseSensitive: boolean,
): string {
  return caseSensitive ? name : name.toLowerCase();
}

/** Create an empty persistent transform cache with isolated filesystem reads. */
export function createTtscTransformCache(
  operations: Partial<TtscTransformFilesystemOperations> = {},
): TtscTransformCache {
  const cache: TtscTransformCache = new Map();
  TRANSFORM_CACHE_FILESYSTEM.set(cache, {
    caseSensitive: operations.caseSensitive,
    exists: operations.exists ?? DEFAULT_FILESYSTEM_OPERATIONS.exists,
    lstat: operations.lstat ?? DEFAULT_FILESYSTEM_OPERATIONS.lstat,
    readFile: operations.readFile ?? DEFAULT_FILESYSTEM_OPERATIONS.readFile,
    readdir: operations.readdir ?? DEFAULT_FILESYSTEM_OPERATIONS.readdir,
    realpath: operations.realpath ?? DEFAULT_FILESYSTEM_OPERATIONS.realpath,
    stat: operations.stat ?? DEFAULT_FILESYSTEM_OPERATIONS.stat,
    statBigInt:
      operations.statBigInt ?? DEFAULT_FILESYSTEM_OPERATIONS.statBigInt,
    platform: operations.platform,
    watch: operations.watch,
  });
  return cache;
}

function transformFilesystem(
  cache: TtscTransformCache | undefined,
): TtscTransformFilesystemOperations {
  return (
    (cache === undefined ? undefined : TRANSFORM_CACHE_FILESYSTEM.get(cache)) ??
    DEFAULT_FILESYSTEM_OPERATIONS
  );
}

function resultFilesystem(
  result: ITtscCompilerTransformation,
): TtscTransformFilesystemOperations {
  return (
    TRANSFORM_RESULT_FILESYSTEM.get(result) ?? DEFAULT_FILESYSTEM_OPERATIONS
  );
}

/**
 * Start a host build, clearing its prior generation and enabling constant-time
 * first delivery for modules compiled during this build.
 *
 * Hosts without a guaranteed build-start callback use persistent validation
 * unless they have another immutable lifecycle. Bun runtime setup, for example,
 * defines one process-scoped module-loading session.
 */
export function beginTtscTransformBuild(cache: TtscTransformCache): void {
  clearTtscTransformCache(cache);
  BUILD_SCOPED_TRANSFORM_CACHES.add(cache);
}

/**
 * Clear a cache and return it to persistent validation mode.
 *
 * This is distinct from {@link beginTtscTransformBuild}: hosts such as Vite's
 * development server may invoke `buildStart` only once for a process that spans
 * many edits, so that callback cannot authorize build-scoped shortcuts.
 */
export function resetTtscTransformCache(cache: TtscTransformCache): void {
  clearTtscTransformCache(cache);
  BUILD_SCOPED_TRANSFORM_CACHES.delete(cache);
}

/** Dispose generation-owned filesystem resources before clearing a cache. */
function clearTtscTransformCache(cache: TtscTransformCache): void {
  const generations = [...cache.values()];
  cache.clear();
  for (const generation of generations) {
    void generation.then(disposeCachedTransform, () => undefined);
  }
}

/**
 * Hooks the bundler adapter passes into {@link transformTtsc} so transform
 * side-channels (plugin-reported dependencies and host resolution candidates)
 * reach the bundler without leaking extra fields on the returned
 * `TransformResult`.
 */
export interface TtscTransformHooks {
  /**
   * Invoked once per absolute watch-input path derived for the transformed file
   * `F`: the plugin-reported `dependencies[F]` list unioned with the host-owned
   * reference graph's contribution — the reachability closure of `graph.edges`
   * from `F`, the `graph.globals` files, the `graph.configs` chain, and missing
   * higher-priority `graph.candidates` — or, for a file the envelope declared
   * `dependenciesComplete`, only `dependencies[F]`, `graph.candidates`, and the
   * universal `graph.configs` chain. Adapters forward this to the bundler's
   * `addWatchFile` so type-only inputs participate in watch-mode and
   * persistent-cache invalidation. See {@link selectWatchInputs} for the exact
   * derivation.
   */
  addWatchFile?: (file: string) => void;
  /**
   * Invoked when the plugin declared the transformed file volatile (the
   * envelope's `volatile` list): its output depends on non-file inputs that no
   * file-dependency snapshot can represent. Adapters should mark the module
   * uncacheable where the bundler exposes that control (e.g. a webpack loader
   * context's `cacheable(false)`).
   */
  markVolatile?: () => void;
}

/**
 * Apply the ttsc plugin transform to a single source file.
 *
 * The function is intentionally project-scoped: it compiles the entire tsconfig
 * project in one shot and extracts the result for `id`. Subsequent calls for
 * sibling files in the same project reuse the cached result as long as none of
 * the project's input files have changed (verified by comparing SHA-256
 * hashes).
 *
 * Returns `undefined` when no transform is needed (declaration files, virtual
 * modules, disabled plugins, or source unchanged after transform).
 *
 * @param id - Bundler module id (may carry a query string or virtual prefix).
 * @param source - Current file content supplied by the bundler.
 * @param options - Resolved plugin options.
 * @param aliases - Raw bundler alias configuration (Vite array or webpack
 *   object).
 * @param cache - Optional project cache. Callers with a real `buildStart`
 *   boundary declare it through {@link beginTtscTransformBuild}; other hosts
 *   retain persistent validation.
 * @param hooks - Optional adapter callbacks; see {@link TtscTransformHooks}.
 *   Dependency notifications fire on cache hits too; watch registrations are
 *   per build, not per compilation.
 */
export async function transformTtsc(
  id: string,
  source: string,
  options: ResolvedTtscUnpluginOptions,
  aliases?: unknown,
  cache?: TtscTransformCache,
  hooks?: TtscTransformHooks,
): Promise<TtscTransformResult | undefined> {
  const filesystem = transformFilesystem(cache);
  const clean = stripQuery(id);
  if (clean.includes("\0")) {
    return undefined;
  }
  const file = path.resolve(clean);
  if (isDeclarationFile(file)) {
    return undefined;
  }
  if (pluginsAreDisabled(options.plugins)) {
    return undefined;
  }

  const tsconfig = resolveTsconfig(file, options.project, filesystem);
  const aliasPaths = createAliasPaths(aliases);
  const key = createTransformCacheKey({
    aliasPaths,
    compilerOptions: options.compilerOptions,
    plugins: options.plugins,
    tsconfig,
  });

  for (;;) {
    let transformed = cache?.get(key);
    if (transformed !== undefined) {
      // A rejected in-flight generation must not stay cached: evict it (only if
      // it is still the current entry) so a later call re-runs the transform.
      const cached = await awaitOrEvict(cache, key, transformed);
      TRANSFORM_RESULT_FILESYSTEM.set(cached.result, filesystem);
      // While this caller awaited the old Promise, another caller may have
      // invalidated it and installed a newer authoritative generation.
      if (cache?.get(key) !== transformed) {
        continue;
      }
      const buildScoped =
        cache !== undefined && BUILD_SCOPED_TRANSFORM_CACHES.has(cache);
      if (!buildScoped) {
        await settleProjectMutationEvents(cached);
        if (cache?.get(key) !== transformed) {
          continue;
        }
      }
      if (
        // A file the plugin declared volatile must never be served from the
        // cache: its output depends on non-file inputs, so the input-hash
        // snapshot cannot prove freshness. Fall through to a fresh transform.
        !isVolatileFile(envelopeDerivation(cached), {
          file,
          projectRoot: cached.projectRoot,
          result: cached.result,
        }) &&
        matchesCachedSource(cached, file, source, buildScoped)
      ) {
        reportSuccessDiagnostics(cached.result);
        // A resolved `"exception"` / `"failure"` envelope makes this throw;
        // that is a failed generation too, so evict before surfacing it.
        const code = selectOrEvict(cache, key, transformed, {
          file,
          projectRoot: cached.projectRoot,
          result: cached.result,
        });
        notifyWatchInputs(hooks, {
          file,
          projectRoot: cached.projectRoot,
          result: cached.result,
          temporaryTsconfig: cached.temporaryTsconfig,
        });
        markCachedSourceServed(cached, file);
        return createTransformResult(source, code);
      }
      evictGeneration(cache, key, transformed);
      // Another caller may have replaced the generation while this caller was
      // awaiting or validating the old one. Retry that authoritative entry
      // instead of deleting it or starting a redundant third compilation.
      if (cache?.get(key) !== undefined) {
        continue;
      }
      transformed = undefined;
    }

    if (transformed === undefined) {
      transformed = transformProject({
        aliasPaths,
        compilerOptions: options.compilerOptions,
        currentFile: file,
        currentSource: source,
        filesystem,
        plugins: options.plugins,
        trackProjectMembership: cache !== undefined,
        tsconfig,
      });
      cache?.set(key, transformed);
    }
    const generation = transformed;
    const cached = await awaitOrEvict(cache, key, generation);
    if (cache !== undefined && cache.get(key) !== generation) {
      continue;
    }
    const { projectRoot, result, temporaryTsconfig } = cached;
    reportSuccessDiagnostics(result);
    const code = selectOrEvict(cache, key, generation, {
      file,
      projectRoot,
      result,
    });
    notifyWatchInputs(hooks, { file, projectRoot, result, temporaryTsconfig });
    markCachedSourceServed(cached, file);
    if (
      isVolatileFile(envelopeDerivation(cached), { file, projectRoot, result })
    ) {
      hooks?.markVolatile?.();
    }
    return createTransformResult(source, code);
  }
}

/**
 * Await a cached generation, evicting it on rejection.
 *
 * The cache stores the in-flight transform Promise before it settles so
 * concurrent callers share one compilation. A rejected generation must not
 * remain the authoritative cached result, or a transient toolchain/host failure
 * becomes permanent for a long-lived worker. Eviction is identity-guarded so a
 * newer generation another caller installed under the same key survives.
 */
async function awaitOrEvict(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
): Promise<TtscCachedProjectTransform> {
  try {
    return await generation;
  } catch (error) {
    evictGeneration(cache, key, generation);
    throw error;
  }
}

/**
 * Extract the transformed source, evicting the generation when the result is a
 * host `"exception"` or compiler `"failure"` (which makes
 * {@link selectTransformedSource} throw). Such a failed generation must not be
 * replayed to later callers of an unchanged module.
 */
function selectOrEvict(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): string {
  try {
    return selectTransformedSource(props);
  } catch (error) {
    evictGeneration(cache, key, generation);
    throw error;
  }
}

/**
 * Delete a failed generation from the cache only when it is still the entry
 * stored under `key`. The identity check prevents an older failed generation's
 * cleanup from removing a newer replacement created by another caller for the
 * same key.
 */
function evictGeneration(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
): void {
  if (cache?.get(key) === generation) {
    cache.delete(key);
    void generation.then(disposeCachedTransform, () => undefined);
  }
}

/** Close one generation's directory watchers exactly once. */
function disposeCachedTransform(cached: TtscCachedProjectTransform): void {
  const trackers = [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
  ];
  cached.projectMutationTracker = undefined;
  cached.hostInputMutationTracker = undefined;
  for (const tracker of trackers) tracker?.close();
}

/**
 * Per-envelope derivation state: every index the per-delivery paths need, built
 * at most once and shared by all deliveries of one compiler result.
 *
 * Building the direct-edge index, the candidate entries, the declared-file
 * identity sets, or the output/dependency key indexes per delivery costs
 * O(envelope) `pathIdentityKey` computations per module — and each of those
 * costs real path-resolution and case-semantics probes
 * ({@link pathIdentityKey}). A graph-bearing envelope (typia >= 13.1.19) turned
 * that into O(modules x edges) filesystem work per build, which is the
 * samchon/ttsc#1007 stall. All deliveries of one generation share this state,
 * so a delivery pays only its own reachability closure with memoized
 * identities.
 *
 * Every index is lazy: a host that never wires `addWatchFile` and never misses
 * a project-relative key pays nothing beyond the volatile/completeness
 * membership sets, which are themselves built on first predicate use.
 *
 * Freshness matches the generation contract: every derivable path is a recorded
 * project or external input, so persistent-mode validation already proves those
 * paths unchanged on every non-build-scoped hit, and any change invalidates the
 * generation — and this state with it. The `WeakMap` key is the envelope object
 * itself, so the state dies when the generation does.
 */
interface TtscEnvelopeDerivation {
  /** One filesystem snapshot for every identity comparison in this envelope. */
  readonly identityContext: FilesystemPathIdentityContext;
  /** Memoized {@link pathIdentityKey} results, keyed by the exact input. */
  readonly identities: Map<string, string>;
  /**
   * Lazily built reference-graph indexes, `undefined` until the first
   * watch-input derivation. A host without an `addWatchFile` hook never pays
   * the O(edges) build.
   */
  graph?: TtscEnvelopeGraphIndexes;
  /**
   * Lazily collected identities of the envelope's `volatile` member files,
   * `undefined` until the first volatility predicate.
   */
  volatileFiles?: Set<string>;
  /**
   * Lazily collected identities of the envelope's `dependenciesComplete` member
   * files, `undefined` until the first completeness predicate.
   */
  dependenciesComplete?: Set<string>;
  /** Universal inputs validated once at generation time and then by metadata. */
  hostInputValidation?: TtscHostInputValidation;
  /**
   * Lazily built identity -> output source index of the `typescript` map (first
   * match wins, mirroring the historical scan). `undefined` until the first
   * project-relative key miss.
   */
  outputIndex?: Map<string, string>;
  /**
   * Lazily built identity -> `dependencies` entries index (first match wins,
   * mirroring the historical scan). `undefined` until the first key miss.
   */
  dependencyIndex?: Map<string, unknown>;
  /** Per-file memo of the final derived watch-input list. */
  readonly watchInputs: Map<string, string[]>;
}

interface TtscHostInputValidation {
  /** Lexical input spellings that existed when the generation was captured. */
  readonly entries: Map<
    string,
    {
      path: string;
      realpath: string | null;
      signature: string;
      strict?: true;
    }
  >;
  /** Identities omitted from the per-module dependency loop below. */
  readonly identities: Set<string>;
  /**
   * Missing paths grouped by the nearest directory whose listing proves them
   * absent.
   */
  readonly missing: Map<string, Set<string>>;
}

/** Reference-graph indexes shared by every watch-input derivation. */
interface TtscEnvelopeGraphIndexes {
  /** Identity of each direct-edge source -> its resolved absolute targets. */
  readonly edges: Map<string, string[]>;
  /** Identity of each direct-edge source -> its absolute spelling. */
  readonly spellings: Map<string, string>;
  /** Resolution-candidate entries in envelope order, sources pre-identified. */
  readonly candidates: { source: string; files: string[] }[];
  /** Resolved absolute `graph.globals` and `graph.configs` members. */
  readonly globals: string[];
  readonly configs: string[];
  /** Every realized/candidate graph path, keyed by filesystem identity. */
  readonly members: Set<string>;
  /** Compiler-time proof for graph members, keyed by filesystem identity. */
  readonly inputProofs: Map<
    string,
    { hash: string | null; path: string; realpath: string | null }
  >;
  /** Aliased graph proof keys that reported contradictory generation states. */
  readonly inputProofConflicts: Set<string>;
}

/**
 * Derivation states keyed by the compiler result object. One result object is
 * produced by one compile against one project root, so the root captured at
 * build time is the only root the state ever sees.
 */
const ENVELOPE_DERIVATIONS = new WeakMap<
  ITtscCompilerTransformation,
  TtscEnvelopeDerivation
>();

/** Return the derivation state of `props.result`, building it on first use. */
function envelopeDerivation(props: {
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): TtscEnvelopeDerivation {
  const existing = ENVELOPE_DERIVATIONS.get(props.result);
  if (existing !== undefined) {
    return existing;
  }
  const created: TtscEnvelopeDerivation = {
    identityContext: createHostPathIdentityContext(
      resultFilesystem(props.result),
    ),
    identities: new Map(),
    watchInputs: new Map(),
  };
  ENVELOPE_DERIVATIONS.set(props.result, created);
  return created;
}

/**
 * Build the reference-graph indexes of one envelope on first watch-input
 * derivation. Malformed sections are dropped member by member, mirroring the
 * historical per-delivery scan.
 */
function envelopeGraphIndexes(
  state: TtscEnvelopeDerivation,
  props: {
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): TtscEnvelopeGraphIndexes {
  if (state.graph !== undefined) {
    return state.graph;
  }
  const built: TtscEnvelopeGraphIndexes = {
    edges: new Map(),
    spellings: new Map(),
    candidates: [],
    globals: [],
    configs: [],
    members: new Set(),
    inputProofs: new Map(),
    inputProofConflicts: new Set(),
  };
  const graph =
    props.result.type === "exception" ? undefined : props.result.graph;
  if (graph !== undefined) {
    for (const [source, targets] of Object.entries(graph.edges ?? {})) {
      if (!Array.isArray(targets)) {
        continue;
      }
      const absolute = path.resolve(props.projectRoot, source);
      const identity = derivationIdentity(state, absolute);
      built.members.add(identity);
      built.spellings.set(identity, absolute);
      const entries = built.edges.get(identity) ?? [];
      entries.push(
        ...targets
          .filter(
            (target): target is string =>
              typeof target === "string" && target.length !== 0,
          )
          .map((target) => {
            const absoluteTarget = path.resolve(props.projectRoot, target);
            built.members.add(derivationIdentity(state, absoluteTarget));
            return absoluteTarget;
          }),
      );
      built.edges.set(identity, entries);
    }
    built.globals.push(...selectListedFiles(props.projectRoot, graph.globals));
    built.configs.push(...selectListedFiles(props.projectRoot, graph.configs));
    for (const input of [...built.globals, ...built.configs]) {
      built.members.add(derivationIdentity(state, input));
    }
    for (const [source, candidates] of Object.entries(graph.candidates ?? {})) {
      if (!Array.isArray(candidates)) {
        continue;
      }
      const sourceIdentity = derivationIdentity(
        state,
        path.resolve(props.projectRoot, source),
      );
      built.members.add(sourceIdentity);
      built.candidates.push({
        source: sourceIdentity,
        files: selectListedFiles(props.projectRoot, candidates),
      });
      for (const candidate of candidates) {
        if (typeof candidate !== "string" || candidate.length === 0) continue;
        built.members.add(
          derivationIdentity(state, path.resolve(props.projectRoot, candidate)),
        );
      }
    }
    for (const [input, hash] of Object.entries(graph.inputHashes ?? {})) {
      if (
        hash !== null &&
        (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash))
      ) {
        continue;
      }
      if (
        graph.inputRealpaths === undefined ||
        !Object.prototype.hasOwnProperty.call(graph.inputRealpaths, input)
      ) {
        continue;
      }
      const reportedRealpath = graph.inputRealpaths[input];
      if (
        reportedRealpath !== null &&
        (typeof reportedRealpath !== "string" ||
          !path.isAbsolute(reportedRealpath))
      ) {
        continue;
      }
      const absolute = path.resolve(props.projectRoot, input);
      const identity = derivationIdentity(state, absolute);
      if (!built.members.has(identity)) continue;
      const proof = {
        hash,
        path: absolute,
        realpath:
          reportedRealpath === null ? null : path.resolve(reportedRealpath),
      };
      const previous = built.inputProofs.get(identity);
      if (
        previous !== undefined &&
        (previous.hash !== proof.hash ||
          !sameHostInputRealpath(
            previous.realpath,
            proof.realpath,
            state.identityContext,
          ))
      ) {
        built.inputProofs.delete(identity);
        built.inputProofConflicts.add(identity);
      } else if (!built.inputProofConflicts.has(identity)) {
        built.inputProofs.set(identity, proof);
      }
    }
  }
  state.graph = built;
  return built;
}

/**
 * {@link pathIdentityKey} memoized inside one envelope's derivation state.
 * Callers always pass already-resolved absolute paths, so the input string is a
 * stable memo key.
 */
function derivationIdentity(
  state: TtscEnvelopeDerivation,
  file: string,
): string {
  const existing = state.identities.get(file);
  if (existing !== undefined) {
    return existing;
  }
  const identity = pathIdentityKey(file, state.identityContext);
  state.identities.set(file, identity);
  return identity;
}

/**
 * Fold one envelope member list (`volatile`, `dependenciesComplete`) into an
 * identity set. Members are keyed like `typescript`, so a project-relative and
 * an absolute spelling of the same file share one identity; a malformed member
 * is ignored rather than fatal.
 */
function collectDeclaredIdentities(
  state: TtscEnvelopeDerivation,
  projectRoot: string,
  listed: unknown,
): Set<string> {
  const output = new Set<string>();
  if (!Array.isArray(listed)) {
    return output;
  }
  for (const entry of listed) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    output.add(derivationIdentity(state, path.resolve(projectRoot, entry)));
  }
  return output;
}

/**
 * Forward every derived watch input for `file` to the adapter's `addWatchFile`
 * hook: the plugin-reported `dependencies[file]` list unioned with the
 * host-owned reference graph's contribution (`reach(edges, file)`, `globals`,
 * `configs`, and resolution candidates).
 *
 * Envelope keys mirror the `typescript` keys (project-relative); values may be
 * project-relative or absolute. Every path is absolutized against the project
 * root and deduplicated; the file itself is dropped (the bundler already
 * watches the module it transforms), and so is the disposed temp-dir tsconfig
 * (see {@link TtscCachedProjectTransform.temporaryTsconfig}).
 */
function notifyWatchInputs(
  hooks: TtscTransformHooks | undefined,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
    temporaryTsconfig?: string;
  },
): void {
  const addWatchFile = hooks?.addWatchFile;
  if (addWatchFile === undefined) {
    return;
  }
  for (const input of selectWatchInputs(props)) {
    addWatchFile(input);
  }
}

/**
 * Derive the absolute, deduplicated watch-input list for a single file.
 *
 * By default the derivation is a union: `dependencies[file] ∪ reach(edges,
 * file) ∪ globals ∪ configs`. The plugin-reported list can only widen the
 * host-owned language-semantic bound, never narrow it. Resolution candidates
 * remain part of that host-owned bound in both modes.
 *
 * An envelope that lists `file` in `dependenciesComplete` narrows it to
 * `dependencies[file] ∪ configs`: the plugin declared its reported list the
 * complete input set for that file, which transfers responsibility for the
 * dropped `reach(edges, file) ∪ globals` bound to the plugin (see the protocol
 * page's completeness contract). The config chain stays universal regardless,
 * because compiler options reach generated code through the host rather than
 * through any file a plugin could consult. A file the plugin also declared
 * volatile keeps the baseline: the two declarations contradict, so the
 * conservative one wins.
 *
 * The derived list is a pure function of the envelope and the file's filesystem
 * identity, so it is computed at most once per generation per file: sibling and
 * repeated deliveries replay the per-envelope memo ({@link envelopeDerivation})
 * instead of re-walking the graph. Returns an empty list on exceptions.
 */
function selectWatchInputs(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  temporaryTsconfig?: string;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const state = envelopeDerivation(props);
  const fileIdentity = derivationIdentity(state, props.file);
  const memoized = state.watchInputs.get(fileIdentity);
  if (memoized !== undefined) {
    return memoized;
  }
  const derived = deriveWatchInputs(state, props, fileIdentity);
  state.watchInputs.set(fileIdentity, derived);
  return derived;
}

/** Compute one file's watch-input list over the shared per-envelope state. */
function deriveWatchInputs(
  state: TtscEnvelopeDerivation,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
    temporaryTsconfig?: string;
  },
  fileIdentity: string,
): string[] {
  const graph = envelopeGraphIndexes(state, props);
  const output: string[] = [];
  const physicalSeen = new Set<string>();
  const lexicalSeen = new Set<string>();
  const excluded = new Set([fileIdentity]);
  if (props.temporaryTsconfig !== undefined) {
    excluded.add(derivationIdentity(state, props.temporaryTsconfig));
  }
  const currentSpelling = path.resolve(props.file);
  const temporarySpelling =
    props.temporaryTsconfig === undefined
      ? undefined
      : path.resolve(props.temporaryTsconfig);
  const appendLexical = (input: string): void => {
    const spelling = path.resolve(input);
    if (
      spelling === currentSpelling ||
      spelling === temporarySpelling ||
      lexicalSeen.has(spelling)
    ) {
      return;
    }
    lexicalSeen.add(spelling);
    physicalSeen.add(derivationIdentity(state, input));
    output.push(input);
  };
  const appendPhysical = (input: string): void => {
    const identity = derivationIdentity(state, input);
    if (excluded.has(identity) || physicalSeen.has(identity)) return;
    physicalSeen.add(identity);
    lexicalSeen.add(path.resolve(input));
    output.push(input);
  };
  for (const input of selectFileDependencies(props)) appendLexical(input);
  for (const input of selectGraphInputs(graph, state, {
    ...props,
    complete:
      declaresCompleteDependencies(state, props) &&
      !isVolatileFile(state, props),
  }))
    appendPhysical(input);
  // Resolution candidates, plugin dependencies, and universal host inputs
  // preserve lexical aliases. Physical deduplication would collapse
  // `alias/selection.cjs` into the selected target path, so a bundler would
  // watch only the target and miss a symlink/junction retarget.
  for (const input of selectResolutionCandidateInputs(graph, state, props))
    appendLexical(input);
  for (const input of selectHostInputs(props)) appendLexical(input);
  return output;
}

/** Return exact host-wide descriptor/config inputs for every output file. */
function selectHostInputs(props: {
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string[] {
  return props.result.type === "exception"
    ? []
    : selectListedFiles(props.projectRoot, props.result.hostInputs);
}

/**
 * Return the module-resolution paths that can supersede a currently resolved
 * module reachable from `file`. They remain host-owned even when a plugin
 * declares `dependenciesComplete`: plugin code cannot vouch for a compiler
 * resolution change that occurs without any plugin input changing.
 *
 * Candidate entries and their source identities come from the shared
 * per-envelope state, so one delivery scans only the candidates themselves
 * instead of re-resolving every candidate source.
 */
function selectResolutionCandidateInputs(
  graph: TtscEnvelopeGraphIndexes,
  state: TtscEnvelopeDerivation,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): string[] {
  if (
    props.result.type === "exception" ||
    props.result.graph?.candidates === undefined
  ) {
    return [];
  }
  const reachable = new Set(
    selectReachableSources(graph, state, props.file).map((source) =>
      derivationIdentity(state, source),
    ),
  );
  const output: string[] = [];
  for (const entry of graph.candidates) {
    if (!reachable.has(entry.source)) {
      continue;
    }
    output.push(...entry.files);
  }
  return output;
}

/**
 * Flatten the host-owned reference graph for one file into absolute paths.
 *
 * The full contribution is the reachability closure of `edges` starting at the
 * file, plus every global-scope file and the config chain. Flattening direct
 * edges into a per-file list happens here — at the adapter boundary — because
 * bundler `fileDependencies` snapshots are flat; the protocol itself carries
 * only direct edges.
 *
 * `complete` drops the reach and globals halves, keeping only the universal
 * config chain: the caller established that the plugin declared its own
 * `dependencies[file]` list the complete replacement for them. Returns an empty
 * list on exceptions or without a graph.
 */
function selectGraphInputs(
  graph: TtscEnvelopeGraphIndexes,
  state: TtscEnvelopeDerivation,
  props: {
    complete: boolean;
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): string[] {
  if (props.result.type === "exception" || props.result.graph === undefined) {
    return [];
  }
  const output: string[] = [];
  if (!props.complete) {
    output.push(...selectReachableEdges(graph, state, props.file));
    output.push(...graph.globals);
  }
  output.push(...graph.configs);
  return output;
}

/**
 * Walk the reachability closure of the graph's direct `edges` from `file`,
 * returning the absolute path of every file reached (the starting file itself
 * excluded, even when a cycle points back at it). Reads the shared per-envelope
 * edge index instead of rebuilding it per delivery.
 */
function selectReachableEdges(
  graph: TtscEnvelopeGraphIndexes,
  state: TtscEnvelopeDerivation,
  file: string,
): string[] {
  const output: string[] = [];
  const visited = new Set<string>([derivationIdentity(state, file)]);
  const queue = [file];
  while (queue.length !== 0) {
    const current = queue.pop()!;
    for (const target of graph.edges.get(derivationIdentity(state, current)) ??
      []) {
      const identity = derivationIdentity(state, target);
      if (visited.has(identity)) {
        continue;
      }
      visited.add(identity);
      queue.push(target);
      output.push(target);
    }
  }
  return output;
}

/**
 * Return the source files whose direct graph edges are reachable from `file`,
 * including `file` itself. Resolution candidates belong to importers rather
 * than targets, so this is intentionally distinct from selectReachableEdges.
 */
function selectReachableSources(
  graph: TtscEnvelopeGraphIndexes,
  state: TtscEnvelopeDerivation,
  file: string,
): string[] {
  const output = [file];
  const visited = new Set<string>([derivationIdentity(state, file)]);
  const queue = [file];
  while (queue.length !== 0) {
    const current = queue.pop()!;
    for (const target of graph.edges.get(derivationIdentity(state, current)) ??
      []) {
      const identity = derivationIdentity(state, target);
      if (visited.has(identity)) {
        continue;
      }
      visited.add(identity);
      queue.push(target);
      output.push(graph.spellings.get(identity) ?? target);
    }
  }
  return output;
}

/**
 * Absolutize one graph string list (`globals`, `configs`), skipping members a
 * malformed envelope section may carry. Duplicates survive; the caller
 * deduplicates the merged list.
 */
function selectListedFiles(projectRoot: string, listed: unknown): string[] {
  if (!Array.isArray(listed)) {
    return [];
  }
  const output: string[] = [];
  for (const entry of listed) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    output.push(path.resolve(projectRoot, entry));
  }
  return output;
}

/**
 * Report whether the plugin declared `file` volatile: its output depends on
 * non-file inputs (environment, time, network), so neither the project
 * transform cache nor a bundler's persistent cache may replay it. Reads the
 * per-envelope identity set instead of rescanning the member list.
 */
function isVolatileFile(
  state: TtscEnvelopeDerivation,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): boolean {
  if (props.result.type === "exception") {
    return false;
  }
  const declared = (state.volatileFiles ??= collectDeclaredIdentities(
    state,
    props.projectRoot,
    props.result.volatile,
  ));
  return declared.has(derivationIdentity(state, props.file));
}

/**
 * Report whether the envelope declared `dependencies[file]` complete, i.e. the
 * plugin took responsibility for that file's whole input set beyond the file
 * itself and the universal config chain. Callers must still keep the baseline
 * for a file the same envelope declared volatile.
 */
function declaresCompleteDependencies(
  state: TtscEnvelopeDerivation,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): boolean {
  if (props.result.type === "exception") {
    return false;
  }
  const declared = (state.dependenciesComplete ??= collectDeclaredIdentities(
    state,
    props.projectRoot,
    props.result.dependenciesComplete,
  ));
  return declared.has(derivationIdentity(state, props.file));
}

/**
 * Extract the absolute, deduplicated dependency list for a single file from the
 * compiler result. Mirrors {@link selectTransformedSource}'s key lookup: fast
 * project-relative match first, then a per-envelope identity index. Returns an
 * empty list on exceptions or when the plugin reported nothing.
 */
function selectFileDependencies(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const dependencies = props.result.dependencies;
  if (dependencies === undefined) {
    return [];
  }
  const state = envelopeDerivation(props);
  const key = toProjectKey(
    props.projectRoot,
    props.file,
    state.identityContext,
  );
  let entries = dependencies[key];
  if (entries === undefined) {
    const index = (state.dependencyIndex ??= createEnvelopeKeyIndex(
      state,
      props.projectRoot,
      dependencies,
    ));
    entries = index.get(derivationIdentity(state, props.file)) as
      | string[]
      | undefined;
  }
  if (!Array.isArray(entries)) {
    return [];
  }
  const output: string[] = [];
  const seen = new Set<string>();
  const fileIdentity = derivationIdentity(state, props.file);
  for (const entry of entries) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    const absolute = path.resolve(props.projectRoot, entry);
    const identity = derivationIdentity(state, absolute);
    if (identity === fileIdentity || seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    output.push(absolute);
  }
  return output;
}

/**
 * Build a first-match identity index over one envelope key map (`typescript`,
 * `dependencies`), mirroring the historical per-delivery scan that returned the
 * first entry whose resolved key matched by filesystem identity.
 */
function createEnvelopeKeyIndex<T>(
  state: TtscEnvelopeDerivation,
  projectRoot: string,
  keyed: Record<string, T>,
): Map<string, T> {
  const index = new Map<string, T>();
  for (const [candidate, value] of Object.entries(keyed)) {
    const identity = derivationIdentity(
      state,
      path.resolve(projectRoot, candidate),
    );
    if (!index.has(identity)) {
      index.set(identity, value);
    }
  }
  return index;
}

/**
 * Strip a query string or hash fragment from a bundler module id.
 *
 * Vite appends query parameters (e.g. `?raw`, `?url`, `?inline`) to
 * differentiate import variants of the same file. We must strip them before
 * using the id as a file-system path.
 */
export function stripQuery(id: string): string {
  const query = id.search(/[?#]/);
  return query === -1 ? id : id.slice(0, query);
}

/**
 * Returns `true` for TypeScript declaration files (`.d.ts`, `.d.mts`,
 * `.d.cts`).
 */
export function isDeclarationFile(id: string): boolean {
  return id.endsWith(".d.ts") || id.endsWith(".d.mts") || id.endsWith(".d.cts");
}

/**
 * Returns `true` when the caller has explicitly opted out of all plugins. An
 * empty array is treated as disabled so we don't invoke the compiler for a
 * no-op transform.
 */
function pluginsAreDisabled(
  plugins: ResolvedTtscUnpluginOptions["plugins"],
): boolean {
  return plugins === false || (Array.isArray(plugins) && plugins.length === 0);
}

/**
 * Build the unplugin transform result, or `undefined` when the transform
 * produced no changes.
 *
 * Returning `undefined` instead of `{ code: source }` lets the bundler skip the
 * unnecessary module update and preserves the original source map.
 */
export function createTransformResult(
  source: string,
  code: string,
): TtscTransformResult | undefined {
  if (source === code) {
    return undefined;
  }
  return { code };
}

/**
 * Validate a cached project transform against the current on-disk project
 * state.
 *
 * Always compares the current module's in-memory source with the generation
 * snapshot. A cache whose owner called {@link beginTtscTransformBuild} can use
 * that comparison alone for a stable generation's first module delivery in the
 * current build. An incomplete generation may not take this shortcut: otherwise
 * a sibling output captured during a filesystem race could still be served
 * once. Later graph-bearing requests validate the file's derived input set and
 * project membership; graph-free envelopes conservatively re-hash the complete
 * project and out-of-walk snapshots. Any mismatch forces a complete
 * re-transform.
 */
function matchesCachedSource(
  cached: TtscCachedProjectTransform,
  file: string,
  source: string,
  buildScoped: boolean,
): boolean {
  const identities = envelopeDerivation(cached).identityContext;
  const currentKey = toProjectKey(cached.projectRoot, file, identities);
  if (cached.inputHashes[currentKey] !== hashText(source)) {
    return false;
  }
  if (
    buildScoped &&
    cached.projectSnapshotComplete === true &&
    !cached.servedFiles?.has(pathIdentityKey(file, identities))
  ) {
    return true;
  }
  if (
    cached.result.type !== "exception" &&
    cached.result.graph !== undefined &&
    cached.projectSnapshotComplete === true &&
    cached.projectDirectories !== undefined &&
    cached.projectMutationTracker !== undefined &&
    cached.hostInputMutationTracker !== undefined
  ) {
    const narrow = matchesNarrowPersistentInputs(cached, file);
    if (narrow !== undefined) {
      return narrow;
    }
    // Notifications stopped proving membership after this generation was
    // produced. Losing the proof is not evidence of a change, so fall through
    // to the snapshot the entry still carries.
  }
  return matchesCompleteInputSnapshot(cached, currentKey, source);
}

/**
 * Validate one graph-bearing cached output against only the inputs that can
 * affect that file. Project membership is validated once per event-loop turn,
 * so sibling module deliveries share one directory-metadata pass instead of
 * multiplying it by module count.
 *
 * Returns `undefined` when live notifications can no longer prove membership.
 * That is the absence of a proof, not evidence of a change, so the caller falls
 * back to complete-snapshot validation instead of discarding the generation.
 */
function matchesNarrowPersistentInputs(
  cached: TtscCachedProjectTransform,
  file: string,
): boolean | undefined {
  if (reportsMembershipChange(cached)) {
    return false;
  }
  if (!notificationsProveMembership(cached)) {
    return undefined;
  }
  const state = envelopeDerivation(cached);
  const hostValidation = state.hostInputValidation;
  if (hostValidation === undefined) {
    return undefined;
  }
  if (!matchesUniversalHostInputs(cached, hostValidation)) {
    return false;
  }
  const inputs = selectWatchInputs({
    file,
    projectRoot: cached.projectRoot,
    result: cached.result,
    temporaryTsconfig: cached.temporaryTsconfig,
  });
  for (const input of inputs) {
    if (hostValidation.identities.has(derivationIdentity(state, input))) {
      continue;
    }
    if (!matchesProvenInput(cached, state, input)) {
      return false;
    }
  }
  return true;
}

/**
 * Validate one derived input against the generation, skipping the content read
 * while the recorded metadata signature still holds.
 *
 * Sibling deliveries of one generation share most of their derived inputs, and
 * `graph.globals` is shared by every one of them, so re-reading and re-hashing
 * the whole derived set per delivery multiplies one generation's proven bytes
 * by the module count. This is the same nanosecond manifest
 * {@link matchesUniversalHostInputs} applies to universal descriptor inputs,
 * extended to the derived set: an unchanged signature stands in for the content
 * comparison, any signature change falls back to the full comparison, and a
 * signature captured around a racing write is never recorded.
 *
 * The signature carries the physical identity of both the lexical path and its
 * link target ({@link inputMetadataSignature}), so retargeting a symlink or
 * junction moves it and the skipped realpath comparison cannot be evaded.
 */
function matchesProvenInput(
  cached: TtscCachedProjectTransform,
  state: TtscEnvelopeDerivation,
  input: string,
): boolean {
  const slot = inputSignatureSlot(cached, state, input);
  if (slot === undefined) {
    return matchesRecordedInput(cached, input);
  }
  const filesystem = resultFilesystem(cached.result);
  const before = inputMetadataSignature(input, filesystem);
  if (before !== undefined && slot.signatures[slot.key] === before) {
    return true;
  }
  if (!matchesRecordedInput(cached, input)) {
    return false;
  }
  const after = inputMetadataSignature(input, filesystem);
  if (after !== undefined && before === after) {
    slot.signatures[slot.key] = after;
  } else {
    delete slot.signatures[slot.key];
  }
  return true;
}

/**
 * Locate the signature manifest entry that owns one recorded input, mirroring
 * {@link matchesRecordedInput}'s own preference for the out-of-walk spelling's
 * snapshot over the walked project's. Returns `undefined` for an input the
 * generation never proved by an unracing disk read, which keeps the full
 * content comparison as the only authority for it.
 */
function inputSignatureSlot(
  cached: TtscCachedProjectTransform,
  state: TtscEnvelopeDerivation,
  input: string,
): { key: string; signatures: Record<string, string> } | undefined {
  const identity = derivationIdentity(state, input);
  const externalSignatures = cached.externalInputSignatures;
  if (
    Object.prototype.hasOwnProperty.call(
      cached.externalInputHashes ?? {},
      identity,
    )
  ) {
    // The recorded hash is identity-keyed because aliases of one physical file
    // share its content; the signature is spelling-keyed because they do not
    // share its metadata.
    const spelling = path.resolve(input);
    return externalSignatures !== undefined &&
      Object.prototype.hasOwnProperty.call(externalSignatures, spelling)
      ? { key: spelling, signatures: externalSignatures }
      : undefined;
  }
  const projectSignatures = cached.inputSignatures;
  if (projectSignatures === undefined) {
    return undefined;
  }
  const projectKey = toProjectKey(
    cached.projectRoot,
    input,
    state.identityContext,
  );
  return Object.prototype.hasOwnProperty.call(projectSignatures, projectKey)
    ? { key: projectKey, signatures: projectSignatures }
    : undefined;
}

/**
 * Validate universal descriptor/config inputs without re-reading them for every
 * module. Existing paths use the same nanosecond metadata manifest that guards
 * GOROOT identity memoization; missing probes are grouped by the nearest
 * existing directory and checked through one exact membership listing.
 */
function matchesUniversalHostInputs(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
): boolean {
  const filesystem = resultFilesystem(cached.result);
  for (const entry of validation.entries.values()) {
    const signature = inputMetadataSignature(entry.path, filesystem);
    if (signature === entry.signature) continue;
    if (entry.strict === true) return false;
    if (hostInputRealpath(entry.path, filesystem) !== entry.realpath)
      return false;
    if (!matchesRecordedInput(cached, entry.path)) {
      return false;
    }
    if (signature === undefined) return false;
    entry.signature = signature;
  }
  for (const [directory, names] of validation.missing) {
    let entries: fs.Dirent[];
    try {
      entries = filesystem.readdir(directory);
    } catch (error) {
      // Only a provably absent/non-directory ancestor keeps every descendant
      // unreachable. Permission and transient I/O failures cannot prove that
      // a candidate is still missing, while replacing the proving directory
      // with an exact file can itself redirect module resolution.
      try {
        if (!filesystem.stat(directory).isDirectory()) return false;
      } catch (statError) {
        if (!isMissingPathError(statError)) return false;
        continue;
      }
      return false;
    }
    const identities = envelopeDerivation(cached).identityContext;
    const caseSensitive = identities.caseSensitive(directory);
    if (
      entries.some((entry) =>
        names.has(normalizeHostInputName(entry.name, caseSensitive)),
      )
    ) {
      return false;
    }
  }
  return true;
}

/** True only for errors that prove a path cannot currently be traversed. */
function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/** Capture the universal-input manifest while the generation is still fresh. */
function captureUniversalHostInputValidation(
  cached: TtscCachedProjectTransform,
  currentFile: string,
): TtscHostInputValidation | undefined {
  const filesystem = resultFilesystem(cached.result);
  const state = envelopeDerivation(cached);
  const validation: TtscHostInputValidation = {
    entries: new Map(),
    identities: new Set(),
    missing: new Map(),
  };
  for (const input of selectPersistentHostInputs({
    filesystem,
    projectRoot: cached.projectRoot,
    result: cached.result,
    temporaryTsconfig: cached.temporaryTsconfig,
  })) {
    const generationHashes =
      cached.result.type === "exception"
        ? undefined
        : cached.result.hostInputHashes;
    const generationRealpaths =
      cached.result.type === "exception"
        ? undefined
        : cached.result.hostInputRealpaths;
    const expected = generationHashes?.[path.resolve(input)];
    // Every persistent universal input must carry an evaluation-time
    // fingerprint. If a plugin/native host cannot provide one, keep the fresh
    // result but decline narrow long-lived reuse.
    if (expected === undefined) {
      const current = path.resolve(currentFile);
      if (path.resolve(input) !== current) return undefined;
      // The current module may be supplied from an unsaved editor buffer. Its
      // generation snapshot is overlaid below from `currentSource`, so a disk
      // fingerprint would be both unavailable and the wrong authority.
    } else if (expected !== hostInputStateHash(input, filesystem)) {
      return undefined;
    }
    const absoluteInput = path.resolve(input);
    if (generationRealpaths !== undefined) {
      if (
        !Object.prototype.hasOwnProperty.call(
          generationRealpaths,
          absoluteInput,
        ) ||
        !sameHostInputRealpath(
          generationRealpaths[absoluteInput],
          hostInputRealpath(input, filesystem),
          state.identityContext,
        )
      ) {
        return undefined;
      }
    }
    const identity = derivationIdentity(state, input);
    validation.identities.add(identity);
    const before = inputMetadataSignature(input, filesystem);
    if (!matchesRecordedInput(cached, input)) return undefined;
    const after = inputMetadataSignature(input, filesystem);
    if (before !== after) return undefined;
    if (after !== undefined) {
      // Do not key this manifest by physical identity. A symlink/junction
      // spelling and its selected target deliberately share that identity,
      // but both lexical paths must survive so retargeting the alias is visible.
      validation.entries.set(path.resolve(input), {
        path: input,
        realpath: hostInputRealpath(input, filesystem),
        signature: after,
      });
      continue;
    }
    const probe = missingPathProbe(input, filesystem);
    if (probe.blocker !== undefined) {
      const blockerIdentity = derivationIdentity(state, probe.blocker);
      const signature = inputMetadataSignature(probe.blocker, filesystem);
      if (signature === undefined) return undefined;
      validation.identities.add(blockerIdentity);
      validation.entries.set(path.resolve(probe.blocker), {
        path: probe.blocker,
        realpath: hostInputRealpath(probe.blocker, filesystem),
        signature,
        strict: true,
      });
      continue;
    }
    let names = validation.missing.get(probe.directory);
    if (names === undefined) {
      names = new Set<string>();
      validation.missing.set(probe.directory, names);
    }
    names.add(
      normalizeHostInputName(
        probe.name,
        state.identityContext.caseSensitive(probe.directory),
      ),
    );
  }
  state.hostInputValidation = validation;
  return validation;
}

/** Metadata identity whose stability lets a generation reuse a content hash. */
function inputMetadataSignature(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | undefined {
  try {
    const link = filesystem.lstat(file);
    let target = link;
    if (link.isSymbolicLink()) {
      try {
        target = filesystem.statBigInt(file);
      } catch {
        // Keep a broken link in the existing-input manifest. Its own metadata
        // stays stable while the target is missing, and the first successful
        // stat after the target appears changes this signature. Treating it as
        // a plain missing path would watch/list only the link's parent, which
        // cannot observe a target created in another directory.
        return [
          link.dev,
          link.ino,
          link.mode,
          link.size,
          link.mtimeNs,
          link.ctimeNs,
          "missing-target",
        ].join(":");
      }
    }
    return [
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
  } catch {
    return undefined;
  }
}

/** Content/kind fingerprint matching the compiler host-input contract. */
function hostInputStateHash(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | null {
  try {
    return hashText(filesystem.readFile(file));
  } catch {
    try {
      return filesystem.stat(file).isDirectory()
        ? hashText("ttsc:host-input:directory\0")
        : null;
    } catch {
      return null;
    }
  }
}

/** Fingerprint the text/kind state returned by TypeScript-Go's filesystem. */
function graphInputStateHash(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | null {
  try {
    const bytes = filesystem.readFile(file);
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      const even = bytes.subarray(
        2,
        2 + Math.floor((bytes.length - 2) / 2) * 2,
      );
      return hashText(Buffer.from(even.toString("utf16le"), "utf8"));
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      const even = Buffer.from(
        bytes.subarray(2, 2 + Math.floor((bytes.length - 2) / 2) * 2),
      );
      even.swap16();
      return hashText(Buffer.from(even.toString("utf16le"), "utf8"));
    }
    const content =
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
        ? bytes.subarray(3)
        : bytes;
    return hashText(content);
  } catch {
    try {
      return filesystem.stat(file).isDirectory()
        ? hashText("ttsc:host-input:directory\0")
        : null;
    } catch {
      return null;
    }
  }
}

/** Physical target selected by a lexical host-input path. */
function hostInputRealpath(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | null {
  try {
    return filesystem.realpath(file);
  } catch {
    return null;
  }
}

/** Compare two reported realpaths by filesystem identity, not Windows spelling. */
function sameHostInputRealpath(
  left: string | null | undefined,
  right: string | null,
  identities: FilesystemPathIdentityContext,
): boolean {
  if (left === undefined || (left === null) !== (right === null)) return false;
  if (left === null || right === null) return true;
  return (
    pathIdentityKey(left, identities) === pathIdentityKey(right, identities)
  );
}

/** Find one directory listing that proves an absent path is still absent. */
function missingPathProbe(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): {
  blocker?: string;
  directory: string;
  name: string;
} {
  let child = path.resolve(file);
  for (;;) {
    const directory = path.dirname(child);
    try {
      const stats = filesystem.stat(directory);
      if (stats.isDirectory()) {
        return { directory, name: path.basename(child) };
      }
      return {
        blocker: directory,
        directory: path.dirname(directory),
        name: path.basename(directory),
      };
    } catch {}
    if (directory === child) {
      return { directory, name: path.basename(child) };
    }
    child = directory;
  }
}

/**
 * Prove one generation from its own recorded snapshot, with no help from live
 * notifications.
 *
 * This is the fallback for a graph-free envelope and for a generation whose
 * watchers could not be opened or have since failed: losing the notification
 * proof must cost the narrow path, not the cache. The walk re-proves membership
 * directly — the recorded directory signatures plus the recorded file-key
 * universe — so a created, deleted, or renamed input still invalidates without
 * any watcher.
 */
function matchesCompleteInputSnapshot(
  cached: TtscCachedProjectTransform,
  currentKey: string,
  source: string,
): boolean {
  if (cached.projectSnapshotComplete !== true) {
    return false;
  }
  const current = collectProjectInputSnapshot(
    cached.projectRoot,
    envelopeDerivation(cached).identityContext,
    resultFilesystem(cached.result),
    cached.inputSignatures === undefined
      ? undefined
      : { hashes: cached.inputHashes, signatures: cached.inputSignatures },
  );
  if (!current.complete) {
    return false;
  }
  if (
    cached.projectDirectories !== undefined &&
    !sameProjectDirectories(
      cached.projectDirectories,
      current.projectDirectories,
    )
  ) {
    return false;
  }
  current.hashes[currentKey] = hashText(source);
  if (!sameHashes(cached.inputHashes, current.hashes)) {
    return false;
  }
  // Re-hash the out-of-walk inputs the compiler reported for this generation
  // over exactly the recorded key universe, so an edit to a `node_modules`
  // declaration or a monorepo sibling source invalidates the entry even in a
  // host that never clears the cache between builds. A new out-of-walk input
  // cannot appear without some recorded input changing first: a new reference
  // edge requires editing an in-walk source, and a new global or config file
  // requires a tsconfig or package manifest change, both of which the project
  // walk above already detects.
  const externalHashes = cached.externalInputHashes ?? {};
  return (
    sameHashes(externalHashes, collectCachedExternalInputHashes(cached)) &&
    matchesExternalInputRealpaths(cached)
  );
}

/** Re-check graph-owned physical identities in complete-snapshot fallback. */
function matchesExternalInputRealpaths(
  cached: TtscCachedProjectTransform,
): boolean {
  const expected = cached.externalInputRealpaths;
  if (expected === undefined || Object.keys(expected).length === 0) return true;
  const state = envelopeDerivation(cached);
  const filesystem = resultFilesystem(cached.result);
  for (const input of cached.externalInputPaths ?? []) {
    const identity = derivationIdentity(state, input);
    if (!Object.prototype.hasOwnProperty.call(expected, identity)) continue;
    if (
      !sameHostInputRealpath(
        expected[identity],
        hostInputRealpath(input, filesystem),
        state.identityContext,
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Capture external-input hashes without attaching post-compile state to an
 * earlier graph. Graph members must carry compiler-time proof and still match
 * it now; plugin-declared dependency-only paths retain the historical
 * post-compile snapshot because their own protocol does not claim generation
 * fingerprints.
 */
function captureExternalInputSnapshot(
  cached: TtscCachedProjectTransform,
  paths: readonly string[],
): {
  complete: boolean;
  hashes: Record<string, string>;
  realpaths: Record<string, string | null>;
  signatures: Record<string, string>;
} {
  const state = envelopeDerivation(cached);
  const filesystem = resultFilesystem(cached.result);
  const graph = envelopeGraphIndexes(state, cached);
  const hashes: Record<string, string> = {};
  const realpaths: Record<string, string | null> = {};
  const signatures: Record<string, string> = {};
  let complete = true;
  // Sandwich every read between two metadata signatures. Only a signature that
  // survived its own read may later stand in for the content comparison; a
  // write racing the capture leaves the input without one, so revalidation
  // keeps re-reading it.
  const record = (
    input: string,
    before: string | undefined,
    after: string | undefined,
  ): void => {
    if (after !== undefined && before === after)
      signatures[path.resolve(input)] = after;
  };
  for (const input of paths) {
    const identity = derivationIdentity(state, input);
    if (graph.members.has(identity)) {
      const proof = graph.inputProofs.get(identity);
      if (proof === undefined || graph.inputProofConflicts.has(identity)) {
        complete = false;
        continue;
      }
      const before = inputMetadataSignature(input, filesystem);
      const currentHash = graphInputStateHash(input, filesystem);
      const after = inputMetadataSignature(input, filesystem);
      if (
        currentHash !== proof.hash ||
        !sameHostInputRealpath(
          proof.realpath,
          hostInputRealpath(input, filesystem),
          state.identityContext,
        )
      ) {
        complete = false;
      } else {
        // The recorded hash is the compiler's own proof, so a signature may
        // only stand for it once the current bytes were shown to match it.
        record(input, before, after);
      }
      hashes[identity] = proof.hash ?? "missing";
      realpaths[identity] = proof.realpath;
      continue;
    }
    const before = inputMetadataSignature(input, filesystem);
    const hash = hostInputStateHash(input, filesystem);
    const after = inputMetadataSignature(input, filesystem);
    hashes[identity] = hash ?? "missing";
    if (hash !== null) record(input, before, after);
  }
  return { complete, hashes, realpaths, signatures };
}

/** Verify every graph member still has the state read by the compiler. */
function matchesCompilerGraphInputProofs(
  cached: TtscCachedProjectTransform,
): boolean {
  if (
    cached.result.type === "exception" ||
    cached.result.graph === undefined ||
    (cached.result.graph.inputHashes === undefined &&
      cached.result.graph.inputRealpaths === undefined)
  ) {
    // Legacy sidecars remain compatible for ordinary in-project graphs. Their
    // out-of-walk members are still rejected by captureExternalInputSnapshot,
    // where a post-compile snapshot cannot prove the compiler's generation.
    return true;
  }
  const state = envelopeDerivation(cached);
  const filesystem = resultFilesystem(cached.result);
  const graph = envelopeGraphIndexes(state, cached);
  if (
    graph.inputProofConflicts.size !== 0 ||
    graph.inputProofs.size !== graph.members.size
  ) {
    return false;
  }
  for (const identity of graph.members) {
    const proof = graph.inputProofs.get(identity);
    if (
      proof === undefined ||
      graphInputStateHash(proof.path, filesystem) !== proof.hash ||
      !sameHostInputRealpath(
        proof.realpath,
        hostInputRealpath(proof.path, filesystem),
        state.identityContext,
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Compare one derived input with the snapshot that owned it at generation. */
function matchesRecordedInput(
  cached: TtscCachedProjectTransform,
  input: string,
): boolean {
  const state = envelopeDerivation(cached);
  const filesystem = resultFilesystem(cached.result);
  const projectKey = toProjectKey(
    cached.projectRoot,
    input,
    state.identityContext,
  );
  const projectHash = Object.prototype.hasOwnProperty.call(
    cached.inputHashes,
    projectKey,
  )
    ? cached.inputHashes[projectKey]
    : undefined;
  const identity = derivationIdentity(state, input);
  const externalHash = (cached.externalInputHashes ?? {})[identity];
  const externalRealpaths = cached.externalInputRealpaths;
  const graphInput =
    externalRealpaths !== undefined &&
    Object.prototype.hasOwnProperty.call(externalRealpaths, identity);
  if (
    externalRealpaths !== undefined &&
    Object.prototype.hasOwnProperty.call(externalRealpaths, identity) &&
    !sameHostInputRealpath(
      externalRealpaths[identity],
      hostInputRealpath(input, filesystem),
      state.identityContext,
    )
  ) {
    return false;
  }
  // Prefer the out-of-walk spelling's own snapshot when it exists. A lexical
  // alias can point back into the walked project, where the physical target's
  // project hash is a different authority (and graph text uses BOM decoding).
  const recorded = externalHash ?? projectHash;
  if (recorded === undefined) {
    return false;
  }
  try {
    const current = graphInput
      ? graphInputStateHash(input, filesystem)
      : hostInputStateHash(input, filesystem);
    return recorded === (current ?? "missing");
  } catch {
    return recorded === "missing";
  }
}

/** Record a successfully selected module as delivered by this generation. */
function markCachedSourceServed(
  cached: TtscCachedProjectTransform,
  file: string,
): void {
  (cached.servedFiles ??= new Set()).add(
    pathIdentityKey(file, envelopeDerivation(cached).identityContext),
  );
}

/**
 * Hash every input file under `projectRoot` (the same walk universe
 * {@link matchesCachedSource} validates against), keyed by project-relative
 * slash path. Exported so hosts without a per-build boundary (`@ttsc/metro`)
 * can fold the identical input universe into their own cache fingerprints.
 */
export function collectProjectInputHashes(
  projectRoot: string,
  identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): Record<string, string> {
  return collectProjectInputSnapshot(projectRoot, identities, filesystem)
    .hashes;
}

/** Hash project files and snapshot the directory topology in one walk. */
function collectProjectInputSnapshot(
  projectRoot: string,
  identities: FilesystemPathIdentityContext,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  proven?: {
    hashes: Record<string, string>;
    signatures: Record<string, string>;
  },
): {
  complete: boolean;
  fileSignatures: Record<string, string>;
  hashes: Record<string, string>;
  projectDirectories: TtscProjectDirectorySnapshot[];
} {
  const hashes: Record<string, string> = {};
  const fileSignatures: Record<string, string> = {};
  const walked = walkProjectInputs(projectRoot, filesystem);
  let complete = walked.complete;
  for (const file of walked.files) {
    try {
      const before = inputMetadataSignature(file, filesystem);
      const key = toProjectKey(projectRoot, file, identities);
      // A file whose signature still equals the one captured around the read
      // that produced the recorded hash carries that content, so the whole
      // project does not have to be re-read to prove one delivery.
      if (
        before !== undefined &&
        proven !== undefined &&
        proven.signatures[key] === before &&
        Object.prototype.hasOwnProperty.call(proven.hashes, key)
      ) {
        hashes[key] = proven.hashes[key]!;
        fileSignatures[key] = before;
        continue;
      }
      const contents = filesystem.readFile(file);
      const after = inputMetadataSignature(file, filesystem);
      hashes[key] = hashText(contents);
      if (before === undefined || after === undefined || before !== after) {
        complete = false;
      } else {
        fileSignatures[key] = after;
      }
    } catch {
      // File watchers may observe a transform while another process is moving
      // or deleting files. The missing key invalidates older cache entries.
      complete = false;
    }
  }
  return {
    complete,
    fileSignatures,
    hashes,
    projectDirectories: walked.directories,
  };
}

/**
 * Enumerate every regular file under `root`, skipping well-known output and
 * tooling directories (see {@link isIgnoredProjectDirectory}).
 *
 * Uses an iterative DFS instead of `fs.readdirSync` recursion to avoid
 * unbounded call-stack depth on deep project trees. The result is sorted so
 * that hash comparisons are deterministic across OS-level directory orderings.
 */
function walkProjectInputs(
  root: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): {
  complete: boolean;
  directories: TtscProjectDirectorySnapshot[];
  files: string[];
} {
  let complete = true;
  const directories: TtscProjectDirectorySnapshot[] = [];
  const files: string[] = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    const before = projectDirectorySignature(current, filesystem);
    if (before === undefined) {
      complete = false;
      continue;
    }
    let entries: fs.Dirent[];
    try {
      entries = filesystem.readdir(current);
    } catch {
      complete = false;
      continue;
    }
    const after = projectDirectorySignature(current, filesystem);
    if (after === undefined || before !== after) {
      complete = false;
    }
    directories.push({
      path: current,
      // If membership moved during enumeration, force the next delivery to
      // replace this generation instead of blessing a torn directory/file
      // snapshot as stable.
      signature:
        after !== undefined && before === after
          ? after
          : `unstable:${before}:${after ?? "missing"}`,
    });
    for (const entry of entries) {
      if (isIgnoredProjectDirectory(entry.name)) {
        continue;
      }
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(file);
      } else if (entry.isFile()) {
        files.push(file);
      }
    }
  }
  directories.sort((left, right) => left.path.localeCompare(right.path));
  files.sort();
  return { complete, directories, files };
}

/** Return a cheap identity for one directory's immediate membership. */
function projectDirectorySignature(
  directory: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | undefined {
  try {
    const stats = filesystem.statBigInt(directory);
    if (!stats.isDirectory()) {
      return undefined;
    }
    return [
      stats.dev,
      stats.ino,
      stats.mode,
      stats.size,
      stats.mtimeNs,
      stats.ctimeNs,
    ].join(":");
  } catch {
    return undefined;
  }
}

/** Compare two deterministic project-directory membership snapshots. */
function sameProjectDirectories(
  left: readonly TtscProjectDirectorySnapshot[],
  right: readonly TtscProjectDirectorySnapshot[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (directory, index) =>
        directory.path === right[index]?.path &&
        directory.signature === right[index]?.signature,
    )
  );
}

/**
 * Open one directory's change notification through the cache-owned watch seam,
 * falling back to the host's own `fs.watch`. Throws exactly where the
 * underlying watch does, so callers classify a registration failure
 * themselves.
 */
function openDirectoryWatch(
  filesystem: TtscTransformFilesystemOperations,
  directory: string,
  listener: (eventType: string, filename: string | null) => void,
  onError: () => void,
): { close: () => void } {
  if (filesystem.watch !== undefined) {
    return filesystem.watch(directory, listener, onError);
  }
  const watcher = fs.watch(
    directory,
    { persistent: false },
    (eventType, filename) =>
      listener(eventType, filename === null ? null : String(filename)),
  );
  watcher.on("error", onError);
  return { close: () => watcher.close() };
}

/** Watch every walked directory for membership changes after generation. */
async function createProjectMutationTracker(
  directories: readonly TtscProjectDirectorySnapshot[],
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): Promise<TtscProjectMutationTracker> {
  const tracker: TtscProjectMutationTracker = {
    close: () => undefined,
    failed: false,
    membershipChanged: false,
  };
  if (process.platform === "win32" && filesystem.watch === undefined) {
    await registerWindowsProjectMutationTracker(
      tracker,
      directories.map((directory) => ({ directory: directory.path })),
      false,
      filesystem,
    );
    return tracker;
  }
  const watchers: { close: () => void }[] = [];
  tracker.close = () => {
    for (const watcher of watchers) watcher.close();
    watchers.length = 0;
  };
  for (const directory of directories) {
    try {
      watchers.push(
        openDirectoryWatch(
          filesystem,
          directory.path,
          (eventType) => {
            if (eventType === "rename") tracker.membershipChanged = true;
          },
          () => {
            tracker.failed = true;
          },
        ),
      );
    } catch {
      tracker.failed = true;
    }
  }
  return tracker;
}

/** Watch exact universal inputs, or their nearest existing parent if missing. */
async function createHostInputMutationTracker(
  inputs: readonly string[],
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): Promise<TtscProjectMutationTracker> {
  const identities = createHostPathIdentityContext(filesystem);
  const namesByDirectory = new Map<
    string,
    { directory: string; names: Set<string> }
  >();
  for (const input of inputs) {
    const absolute = path.resolve(input);
    const probe = filesystem.exists(absolute)
      ? { directory: path.dirname(absolute), name: path.basename(absolute) }
      : missingPathProbe(absolute, filesystem);
    const directoryIdentity = identities.resolve(probe.directory);
    let location = namesByDirectory.get(directoryIdentity.key);
    if (location === undefined) {
      location = {
        directory: directoryIdentity.path,
        names: new Set<string>(),
      };
      namesByDirectory.set(directoryIdentity.key, location);
    }
    location.names.add(
      normalizeHostInputName(
        probe.name,
        identities.caseSensitive(directoryIdentity.path),
      ),
    );
  }
  const locations = [...namesByDirectory.values()].map((location) => ({
    directory: location.directory,
    names: [...location.names],
  }));
  const tracker: TtscProjectMutationTracker = {
    close: () => undefined,
    failed: false,
    membershipChanged: false,
  };
  if (process.platform === "win32" && filesystem.watch === undefined) {
    await registerWindowsProjectMutationTracker(
      tracker,
      locations,
      true,
      filesystem,
    );
    return tracker;
  }
  const watchers: { close: () => void }[] = [];
  tracker.close = () => {
    for (const watcher of watchers) watcher.close();
    watchers.length = 0;
  };
  for (const location of locations) {
    try {
      const names = new Set(location.names);
      const caseSensitive = identities.caseSensitive(location.directory);
      watchers.push(
        openDirectoryWatch(
          filesystem,
          location.directory,
          (_eventType, filename) => {
            const reported =
              filename === null
                ? null
                : normalizeHostInputName(filename, caseSensitive);
            if (reported === null || names.has(reported)) {
              tracker.membershipChanged = true;
            }
          },
          () => {
            tracker.failed = true;
          },
        ),
      );
    } catch {
      tracker.failed = true;
    }
  }
  return tracker;
}

interface WindowsProjectMutationBroker {
  child: ChildProcess;
  nextId: number;
  pendingRegistrations: number;
  trackers: Map<
    number,
    {
      ready: () => void;
      tracker: TtscProjectMutationTracker;
    }
  >;
}

let windowsProjectMutationBroker: WindowsProjectMutationBroker | undefined;

interface WindowsMutationLocation {
  directory: string;
  names?: string[];
}

/**
 * Register directory watches in an isolated Windows process.
 *
 * Node's Windows fs-event backend can assert in native code when a watched
 * temporary tree is deleted. Isolation turns that unrecoverable process abort
 * into an ordinary broker exit and a conservative cache miss in the host.
 */
async function registerWindowsProjectMutationTracker(
  tracker: TtscProjectMutationTracker,
  locations: readonly WindowsMutationLocation[],
  allEvents: boolean,
  filesystem: TtscTransformFilesystemOperations,
): Promise<void> {
  const broker = getWindowsProjectMutationBroker();
  const normalized = locations.map((location) => {
    let directory: string;
    try {
      directory = filesystem.realpath(location.directory);
    } catch {
      directory = path.resolve(location.directory);
    }
    return {
      directory,
      ...(location.names === undefined ? {} : { names: location.names }),
    };
  });
  broker.pendingRegistrations += 1;
  broker.child.ref();
  broker.child.channel?.ref();
  const id = broker.nextId++;
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  broker.trackers.set(id, { ready: resolveReady, tracker });
  tracker.close = () => {
    const active = broker.trackers.get(id);
    if (active === undefined) return;
    broker.trackers.delete(id);
    active.ready();
    broker.child.send?.({ id, op: "remove" });
    if (broker.trackers.size === 0) {
      broker.child.disconnect?.();
      broker.child.kill();
      if (windowsProjectMutationBroker === broker) {
        windowsProjectMutationBroker = undefined;
      }
    }
  };
  broker.child.send?.({
    allEvents,
    locations: normalized,
    id,
    op: "add",
  });
  try {
    await ready;
  } finally {
    broker.pendingRegistrations -= 1;
    if (broker.pendingRegistrations === 0) {
      broker.child.unref();
      broker.child.channel?.unref();
    }
  }
}

function getWindowsProjectMutationBroker(): WindowsProjectMutationBroker {
  if (windowsProjectMutationBroker !== undefined) {
    return windowsProjectMutationBroker;
  }
  const child = spawn(process.execPath, ["-e", WINDOWS_WATCH_BROKER_SOURCE], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    windowsHide: true,
  });
  const broker: WindowsProjectMutationBroker = {
    child,
    nextId: 1,
    pendingRegistrations: 0,
    trackers: new Map(),
  };
  const fail = (): void => {
    for (const registration of broker.trackers.values()) {
      registration.tracker.failed = true;
      registration.ready();
    }
    broker.trackers.clear();
    if (windowsProjectMutationBroker === broker) {
      windowsProjectMutationBroker = undefined;
    }
  };
  child.on("error", fail);
  child.on("exit", fail);
  child.on("message", (message: unknown) => {
    if (message === null || typeof message !== "object") return;
    const record = message as {
      failed?: boolean;
      id?: number;
      ready?: boolean;
    };
    if (typeof record.id !== "number") return;
    const registration = broker.trackers.get(record.id);
    if (registration === undefined) return;
    if (record.failed === true) registration.tracker.failed = true;
    if (record.ready === true) registration.ready();
    if (record.ready !== true && record.failed !== true) {
      registration.tracker.membershipChanged = true;
    }
  });
  windowsProjectMutationBroker = broker;
  return broker;
}

const WINDOWS_WATCH_BROKER_SOURCE = [
  'const fs = require("node:fs");',
  "const groups = new Map();",
  'process.on("message", (message) => {',
  '  if (message.op === "remove") {',
  "    close(message.id);",
  "    return;",
  "  }",
  '  if (message.op !== "add") return;',
  "  const watchers = [];",
  "  let failed = false;",
  "  for (const location of message.locations) {",
  "    try {",
  "      const names = location.names === undefined ? undefined : new Set(location.names.map((name) => name.toLowerCase()));",
  "      const watcher = fs.watch(location.directory, { persistent: false }, (event, filename) => {",
  "        const matches = names === undefined || filename === null || names.has(String(filename).toLowerCase());",
  '        if (matches && (message.allEvents || event === "rename")) process.send?.({ id: message.id });',
  "      });",
  '      watcher.on("error", () => process.send?.({ failed: true, id: message.id }));',
  "      watchers.push(watcher);",
  "    } catch {",
  "      failed = true;",
  "    }",
  "  }",
  "  groups.set(message.id, watchers);",
  "  process.send?.({ failed, id: message.id, ready: true });",
  "});",
  'process.on("disconnect", () => {',
  "  for (const id of groups.keys()) close(id);",
  "  process.exit(0);",
  "});",
  "function close(id) {",
  "  for (const watcher of groups.get(id) ?? []) watcher.close();",
  "  groups.delete(id);",
  "}",
].join("\n");

/**
 * Report whether either live notification observed a membership event. This is
 * positive evidence that the generation is stale, so it outranks the question
 * of whether the notifications still work.
 */
function reportsMembershipChange(cached: TtscCachedProjectTransform): boolean {
  return (
    cached.projectMutationTracker?.membershipChanged === true ||
    cached.hostInputMutationTracker?.membershipChanged === true
  );
}

/**
 * Report whether both live notifications can still prove membership. A watcher
 * that failed to register, or that errored after the generation was produced,
 * proves nothing either way — it never proves the generation stale.
 */
function notificationsProveMembership(
  cached: TtscCachedProjectTransform,
): boolean {
  for (const tracker of [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
  ]) {
    if (tracker === undefined || tracker.failed) {
      return false;
    }
  }
  return true;
}

/**
 * Yield once before persistent validation so synchronous edits can reach the
 * directory watchers that guard membership. Concurrent sibling deliveries share
 * the same barrier.
 */
async function settleProjectMutationEvents(
  cached: TtscCachedProjectTransform,
): Promise<void> {
  const trackers = [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
  ].filter(
    (tracker): tracker is TtscProjectMutationTracker => tracker !== undefined,
  );
  await Promise.all(
    trackers.map(async (tracker) => {
      tracker.settle ??= new Promise<void>((resolve) => {
        const settled = () => {
          tracker.settle = undefined;
          resolve();
        };
        if (process.platform === "win32") setTimeout(settled, 10);
        else setImmediate(settled);
      });
      await tracker.settle;
    }),
  );
}

/**
 * Report whether an absolute `file` belongs to the project walk universe of
 * `root`: it lies under `root`, every component exists without traversing a
 * symbolic link, the leaf is a regular file, and no segment of the relative
 * path is ignored. The predicate mirrors {@link walkProjectInputs} exactly, so
 * "walk-visible" here means "hashed by {@link collectProjectInputHashes}".
 * Missing paths and files reached through symlinks or Windows junctions are
 * out-of-walk inputs that only the reference graph can prove relevant.
 */
export function isProjectWalkPath(
  root: string,
  file: string,
  _identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): boolean {
  // Walk membership is lexical. Resolving `file` to physical identity first
  // would turn `root/alias/value.ts` into `root/target/value.ts`, hide the
  // symlink segment from the lstat loop below, and falsely claim the project
  // walk hashed a path it deliberately never followed.
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, path.resolve(file));
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return false;
  }
  const segments = relative.split(path.sep);
  if (segments.some(isIgnoredProjectDirectory)) {
    return false;
  }
  let current = resolvedRoot;
  for (let index = 0; index < segments.length; ++index) {
    current = path.join(current, segments[index]!);
    let stats: fs.BigIntStats;
    try {
      stats = filesystem.lstat(current);
    } catch {
      return false;
    }
    if (stats.isSymbolicLink()) {
      return false;
    }
    const leaf = index === segments.length - 1;
    if ((leaf && !stats.isFile()) || (!leaf && !stats.isDirectory())) {
      return false;
    }
  }
  return true;
}

/**
 * Hash a list of absolute out-of-walk input paths: content SHA-256 for a
 * readable file, a stable directory-kind digest for a directory candidate, and
 * a stable `missing` marker otherwise. Keys use filesystem identity so
 * case-only spellings share one snapshot entry, while reads retain the original
 * path supplied by the compiler. The marker is state, not an error — a recorded
 * input disappearing (or reappearing) must change the comparison exactly like a
 * content edit. Exported so `@ttsc/metro` can re-hash its recorded snapshot
 * with identical semantics at cache-key time.
 */
export function collectExternalInputHashes(
  paths: readonly string[],
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): Record<string, string> {
  const hashes: Record<string, string> = {};
  const identities = createHostPathIdentityContext(filesystem);
  for (const file of paths) {
    const identity = pathIdentityKey(file, identities);
    if (identity in hashes) {
      continue;
    }
    hashes[identity] = hostInputStateHash(file, filesystem) ?? "missing";
  }
  return hashes;
}

/** Re-hash a cached mixed graph/dependency input set with its owning codec. */
function collectCachedExternalInputHashes(
  cached: TtscCachedProjectTransform,
): Record<string, string> {
  const hashes: Record<string, string> = {};
  const state = envelopeDerivation(cached);
  const graphRealpaths = cached.externalInputRealpaths ?? {};
  const filesystem = resultFilesystem(cached.result);
  const recordedHashes = cached.externalInputHashes ?? {};
  const recordedSignatures = cached.externalInputSignatures ?? {};
  for (const file of cached.externalInputPaths ??
    Object.keys(cached.externalInputHashes ?? {})) {
    const identity = derivationIdentity(state, file);
    if (identity in hashes) continue;
    // Reuse the recorded hash of an out-of-walk input whose signature still
    // equals the one captured around the read that proved it. The signature is
    // keyed by this exact spelling, so an alias of the same physical file
    // cannot answer for it.
    const spelling = path.resolve(file);
    if (
      Object.prototype.hasOwnProperty.call(recordedSignatures, spelling) &&
      Object.prototype.hasOwnProperty.call(recordedHashes, identity) &&
      inputMetadataSignature(file, filesystem) === recordedSignatures[spelling]
    ) {
      hashes[identity] = recordedHashes[identity]!;
      continue;
    }
    hashes[identity] =
      (Object.prototype.hasOwnProperty.call(graphRealpaths, identity)
        ? graphInputStateHash(file, filesystem)
        : hostInputStateHash(file, filesystem)) ?? "missing";
  }
  return hashes;
}

/**
 * Derive the absolute out-of-walk input set of a whole project transform: the
 * union of every reference-graph member (edge keys and targets, globals, the
 * config chain) and every plugin-reported dependency, minus everything the
 * project walk already hashes and the disposed temp-dir tsconfig. These are the
 * inputs {@link matchesCachedSource}'s walk cannot see. Resolution candidates
 * that are still missing remain in this set even under the project root: the
 * first walk cannot hash a file that has not been created yet.
 *
 * A `dependenciesComplete` declaration deliberately does not narrow the stored
 * set: other files in the same whole-project result can still own the omitted
 * members. Persistent validation selects the requested file's subset through
 * {@link selectWatchInputs}, while graph-free envelopes use this union as their
 * conservative fallback.
 */
function selectExternalInputPaths(props: {
  filesystem?: TtscTransformFilesystemOperations;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  temporaryTsconfig?: string;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const members: string[] = [];
  const filesystem = props.filesystem ?? DEFAULT_FILESYSTEM_OPERATIONS;
  const identities = createHostPathIdentityContext(filesystem);
  const resolutionCandidates = new Set<string>();
  const graph = props.result.graph;
  if (graph !== undefined) {
    for (const [source, targets] of Object.entries(graph.edges ?? {})) {
      members.push(source);
      if (Array.isArray(targets)) {
        members.push(...targets);
      }
    }
    for (const listed of [graph.globals, graph.configs]) {
      if (Array.isArray(listed)) {
        members.push(...listed);
      }
    }
    for (const candidates of Object.values(graph.candidates ?? {})) {
      if (!Array.isArray(candidates)) {
        continue;
      }
      for (const candidate of candidates) {
        if (typeof candidate !== "string" || candidate.length === 0) {
          continue;
        }
        const absolute = path.resolve(props.projectRoot, candidate);
        members.push(candidate);
        resolutionCandidates.add(pathIdentityKey(absolute, identities));
      }
    }
  }
  for (const entries of Object.values(props.result.dependencies ?? {})) {
    if (Array.isArray(entries)) {
      members.push(...entries);
    }
  }
  if (Array.isArray(props.result.hostInputs)) {
    for (const input of props.result.hostInputs) {
      members.push(input);
      if (typeof input === "string" && input.length !== 0) {
        // Plugin discovery inputs deliberately include absent config and
        // resolution probes. A project walk cannot snapshot a path that does
        // not exist yet, even when its spelling lies below projectRoot.
        resolutionCandidates.add(
          pathIdentityKey(path.resolve(props.projectRoot, input), identities),
        );
      }
    }
  }
  const excluded =
    props.temporaryTsconfig === undefined
      ? undefined
      : pathIdentityKey(props.temporaryTsconfig, identities);
  const output: string[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    if (typeof member !== "string" || member.length === 0) {
      continue;
    }
    const absolute = path.resolve(props.projectRoot, member);
    const spelling = path.resolve(absolute);
    const identity = pathIdentityKey(absolute, identities);
    const missingCandidate =
      resolutionCandidates.has(identity) && !filesystem.exists(absolute);
    if (
      identity === excluded ||
      seen.has(spelling) ||
      (!missingCandidate &&
        isProjectWalkPath(props.projectRoot, absolute, identities, filesystem))
    ) {
      continue;
    }
    // Preserve distinct lexical aliases even when they currently select the
    // same physical file. A later retarget must validate the alias itself.
    seen.add(spelling);
    output.push(absolute);
  }
  output.sort();
  return output;
}

function isIgnoredProjectDirectory(name: string): boolean {
  return (
    name === ".git" ||
    name === ".ttsc" ||
    name === ".cache" ||
    name === ".next" ||
    name === ".nuxt" ||
    name === ".svelte-kit" ||
    name === ".turbo" ||
    name === ".vite" ||
    name === "build" ||
    name === "coverage" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "out" ||
    name === "temp" ||
    name === "tmp"
  );
}

function sameHashes(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => right[key] === left[key]);
}

function hashText(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function transformProject(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  currentFile: string;
  currentSource: string;
  filesystem: TtscTransformFilesystemOperations;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  trackProjectMembership: boolean;
  tsconfig: string;
}): Promise<TtscCachedProjectTransform> {
  const projectRoot = path.dirname(props.tsconfig);
  const scratchDirectory = createTransformScratchDirectory(
    projectRoot,
    props.filesystem,
  );
  let tracker: TtscProjectMutationTracker | undefined;
  let retainTracker = false;
  let hostInputTracker: TtscProjectMutationTracker | undefined;
  try {
    const configured = createTransformTsconfig(props, scratchDirectory);
    const temporaryTsconfig =
      configured.path === props.tsconfig ? undefined : configured.path;
    const identities = createHostPathIdentityContext(props.filesystem);
    const before = collectProjectInputSnapshot(
      projectRoot,
      identities,
      props.filesystem,
    );
    tracker = props.trackProjectMembership
      ? await createProjectMutationTracker(
          before.projectDirectories,
          props.filesystem,
        )
      : undefined;
    const result = withTransformScratchEnvironment(scratchDirectory, () =>
      new TtscCompiler({
        cwd: projectRoot,
        // The generated tsconfig (if any) lives outside the project directory,
        // so declare the real project as the plugin config anchor: utility
        // plugin config discovery (banner.config.*, strip.config.*,
        // lint.config.*) and relative configFile resolution walk the project,
        // never the temp tree. In the passthrough case this equals the
        // tsconfig's own directory, the default anchor.
        pluginConfigDir: projectRoot,
        plugins: props.plugins,
        projectRoot,
        tsconfig: configured.path,
        env: transformScratchEnvironment(scratchDirectory),
      }).transform(),
    );
    TRANSFORM_RESULT_FILESYSTEM.set(result, props.filesystem);
    const persistentHostInputs = selectPersistentHostInputs({
      filesystem: props.filesystem,
      projectRoot,
      result,
      temporaryTsconfig,
    });
    hostInputTracker = props.trackProjectMembership
      ? await createHostInputMutationTracker(
          persistentHostInputs,
          props.filesystem,
        )
      : undefined;
    const externalInputPaths = selectExternalInputPaths({
      filesystem: props.filesystem,
      projectRoot,
      result,
      temporaryTsconfig,
    });
    const inputSnapshot = collectProjectInputSnapshot(
      projectRoot,
      identities,
      props.filesystem,
    );
    // Whether the recorded snapshot describes one coherent state of the
    // project. A membership event during the compile taints it exactly like an
    // unstable walk pair; whether notifications can be *opened* is a separate
    // fact, tracked below, because a generation with no watcher is still
    // provable from its own recorded state.
    let stableProjectSnapshot =
      before.complete &&
      inputSnapshot.complete &&
      sameHashes(before.hashes, inputSnapshot.hashes) &&
      sameHashes(before.fileSignatures, inputSnapshot.fileSignatures) &&
      sameProjectDirectories(
        before.projectDirectories,
        inputSnapshot.projectDirectories,
      ) &&
      tracker?.membershipChanged !== true &&
      hostInputTracker?.membershipChanged !== true;
    const notificationsAvailable =
      tracker?.failed !== true && hostInputTracker?.failed !== true;
    // Overlay the in-memory source only after proving the two on-disk snapshots
    // stable; an unsaved editor buffer must not look like a compile-time race.
    const currentFileKey = toProjectKey(
      projectRoot,
      props.currentFile,
      identities,
    );
    inputSnapshot.hashes[currentFileKey] = hashText(props.currentSource);
    // That overlay makes this one key the only recorded hash a disk signature
    // cannot stand for: the bytes it names came from the bundler, not the file.
    delete inputSnapshot.fileSignatures[currentFileKey];
    const cached: TtscCachedProjectTransform = {
      // Capture the out-of-walk input hashes while the generation is fresh so
      // cache validation can re-check them; computed before dispose so the
      // exclusion of the temp-dir tsconfig is the only reason it never keys.
      externalInputHashes: {},
      externalInputRealpaths: {},
      externalInputPaths,
      inputHashes: inputSnapshot.hashes,
      inputSignatures: inputSnapshot.fileSignatures,
      projectDirectories: inputSnapshot.projectDirectories,
      projectSnapshotComplete: false,
      projectRoot,
      result,
      servedFiles: new Set(),
      // Remember the generated temp-dir tsconfig (disposed below) so watch
      // derivation can drop it from the envelope's config chain; a registered
      // but deleted file would invalidate every persistent-cache snapshot.
      ...(temporaryTsconfig === undefined ? {} : { temporaryTsconfig }),
    };
    const externalInputSnapshot = captureExternalInputSnapshot(
      cached,
      externalInputPaths,
    );
    cached.externalInputHashes = externalInputSnapshot.hashes;
    cached.externalInputRealpaths = externalInputSnapshot.realpaths;
    cached.externalInputSignatures = externalInputSnapshot.signatures;
    stableProjectSnapshot =
      stableProjectSnapshot &&
      matchesCompilerGraphInputProofs(cached) &&
      externalInputSnapshot.complete &&
      captureUniversalHostInputValidation(cached, props.currentFile) !==
        undefined;
    cached.projectSnapshotComplete = stableProjectSnapshot;
    // Attach notifications only while they can actually prove membership. A
    // generation that could not open its watchers keeps its recorded snapshot
    // and validates through it, rather than losing the cache entirely.
    const notifying = stableProjectSnapshot && notificationsAvailable;
    if (notifying && tracker !== undefined) {
      cached.projectMutationTracker = tracker;
    }
    if (notifying && hostInputTracker !== undefined) {
      cached.hostInputMutationTracker = hostInputTracker;
    }
    retainTracker =
      notifying && tracker !== undefined && hostInputTracker !== undefined;
    return cached;
  } finally {
    try {
      if (!retainTracker && tracker !== undefined) {
        tracker.close();
      }
    } finally {
      try {
        if (!retainTracker && hostInputTracker !== undefined) {
          hostInputTracker.close();
        }
      } finally {
        fs.rmSync(scratchDirectory, { force: true, recursive: true });
      }
    }
  }
}

/** Exclude the disposed overlay tsconfig from live host-input tracking. */
function selectPersistentHostInputs(props: {
  filesystem: TtscTransformFilesystemOperations;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  temporaryTsconfig?: string;
}): string[] {
  if (props.result.type === "exception") return [];
  const inputs = selectListedFiles(props.projectRoot, props.result.hostInputs);
  if (props.temporaryTsconfig === undefined) return inputs;
  const identities = createHostPathIdentityContext(props.filesystem);
  const temporary = pathIdentityKey(props.temporaryTsconfig, identities);
  return inputs.filter(
    (input) => pathIdentityKey(input, identities) !== temporary,
  );
}

function createTransformTsconfig(
  props: {
    aliasPaths: Record<string, string[]>;
    compilerOptions: Record<string, unknown>;
    tsconfig: string;
  },
  scratchDirectory: string,
): { path: string } {
  const compilerOptions = normalizeCompilerOptionsForGeneratedTsconfig(
    {
      ...props.compilerOptions,
      ...createAliasCompilerOptions(props),
    },
    path.dirname(props.tsconfig),
  );
  if (Object.keys(compilerOptions).length === 0) {
    return { path: props.tsconfig };
  }

  const file = path.join(scratchDirectory, "tsconfig.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        extends: normalizePath(props.tsconfig),
        compilerOptions,
      },
      null,
      2,
    ),
    "utf8",
  );
  return { path: file };
}

/** Create compiler scratch storage outside the project snapshot and watchers. */
function createTransformScratchDirectory(
  projectRoot: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string {
  const root = path.resolve(projectRoot);
  const canonicalRoot = filesystem.realpath(root);
  const platformTemp =
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Temp")
      : "/tmp";
  const candidates = [
    os.tmpdir(),
    platformTemp,
    path.dirname(root),
    os.homedir(),
  ];
  const canonicalCandidates = new Set<string>();
  let failure: unknown;
  for (const candidate of new Set(candidates.map((dir) => path.resolve(dir)))) {
    if (pathIsWithin(candidate, root)) continue;
    let canonicalCandidate: string;
    try {
      canonicalCandidate = filesystem.realpath(candidate);
    } catch (error) {
      failure = error;
      continue;
    }
    if (
      pathIsWithin(canonicalCandidate, canonicalRoot) ||
      canonicalCandidates.has(canonicalCandidate)
    ) {
      continue;
    }
    canonicalCandidates.add(canonicalCandidate);
    let directory: string;
    try {
      directory = fs.mkdtempSync(
        path.join(canonicalCandidate, "ttsc-unplugin-"),
      );
    } catch (error) {
      failure = error;
      continue;
    }
    let canonicalDirectory: string;
    try {
      canonicalDirectory = filesystem.realpath(directory);
    } catch (error) {
      try {
        fs.rmdirSync(directory);
      } catch (cleanupError) {
        throw cleanupError;
      }
      failure = error;
      continue;
    }
    // Use the postflight canonical spelling from this point onward. Returning
    // the candidate-relative spelling would let another process retarget its
    // parent symlink/junction after validation, redirecting compiler writes or
    // the final recursive removal into the project.
    if (!pathIsWithin(canonicalDirectory, canonicalRoot)) {
      return canonicalDirectory;
    }
    // Refuse the result and synchronously remove only our empty random child
    // through the identity that the postflight check just classified.
    fs.rmdirSync(canonicalDirectory);
  }
  throw (
    failure ??
    new Error("ttsc: no temporary directory exists outside the project")
  );
}

function pathIsWithin(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

/** Route all compiler/plugin scratch to one owned directory outside project. */
function transformScratchEnvironment(directory: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TEMP: directory,
    TMP: directory,
    TMPDIR: directory,
  };
}

/** Scope parent-process temp consumers to the same owned scratch directory. */
function withTransformScratchEnvironment<T>(
  scratchDirectory: string,
  callback: () => T,
): T {
  const environment = transformScratchEnvironment(scratchDirectory);
  const previous = {
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
  };
  process.env.TEMP = environment.TEMP;
  process.env.TMP = environment.TMP;
  process.env.TMPDIR = environment.TMPDIR;
  try {
    return callback();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/**
 * Resolve all relative paths inside `compilerOptions` against `tsconfigDir`.
 *
 * The generated tsconfig lives in a temporary directory outside the project, so
 * any relative path (e.g. `"outDir": "../dist"`) that was meaningful relative
 * to the original tsconfig must be converted to an absolute path before writing
 * the generated file. Otherwise TypeScript-Go resolves it against the temp
 * dir.
 *
 * `paths` targets are absolutized for the same reason, with the extra twist
 * that TypeScript-Go rejects bare non-relative targets outright (TS5090) and
 * has removed `baseUrl` (TS5102), so anchoring them as absolute paths is the
 * only temp-dir-safe encoding. No synthetic `baseUrl` is ever written.
 */
function normalizeCompilerOptionsForGeneratedTsconfig(
  compilerOptions: Record<string, unknown>,
  tsconfigDir: string,
): Record<string, unknown> {
  const output = { ...compilerOptions };
  // Scalar path fields: resolve each against the original tsconfig directory.
  for (const key of ["declarationDir", "outDir", "rootDir"]) {
    if (typeof output[key] === "string") {
      output[key] = path.resolve(tsconfigDir, output[key]);
    }
  }
  // Array path fields: resolve each element individually.
  for (const key of ["rootDirs", "typeRoots"]) {
    if (Array.isArray(output[key])) {
      output[key] = output[key].map((entry) =>
        typeof entry === "string" ? path.resolve(tsconfigDir, entry) : entry,
      );
    }
  }
  const paths = readPaths(output.paths);
  if (Object.keys(paths).length !== 0) {
    output.paths = Object.fromEntries(
      Object.entries(paths).map(([key, targets]) => [
        key,
        targets.map((target) => absolutizePathsTarget(tsconfigDir, target)),
      ]),
    );
  }
  if (Array.isArray(output.plugins)) {
    output.plugins = output.plugins.map((entry) =>
      normalizePluginConfigForGeneratedTsconfig(entry, tsconfigDir),
    );
  }
  return output;
}

/**
 * Absolutize the relative path-typed keys of one plugin entry before it is
 * written into the generated temp-dir tsconfig: `config`/`source`/`transform`
 * are the descriptor-resolution keys, and `configFile` is the config-file
 * override accepted by the shipped utility plugins (`@ttsc/banner`,
 * `@ttsc/strip`, `@ttsc/lint`). Left relative, each would resolve against the
 * temp directory instead of the project.
 */
function normalizePluginConfigForGeneratedTsconfig(
  entry: unknown,
  tsconfigDir: string,
): unknown {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return entry;
  }
  const output: Record<string, unknown> = { ...entry };
  for (const key of ["config", "configFile", "source", "transform"]) {
    const value = output[key];
    if (typeof value === "string" && isRelativeSpecifier(value)) {
      output[key] = path.resolve(tsconfigDir, value);
    }
  }
  return output;
}

/**
 * Build the `paths` overlay that forwards bundler aliases to the compiler.
 *
 * Because the generated tsconfig `extends` the project one and TypeScript
 * merges `compilerOptions` per option key, declaring `paths` here replaces the
 * project's own `paths` wholesale. The overlay therefore re-states the
 * project's effective mappings first, so tsconfig-only aliases keep resolving;
 * inline `compilerOptions.paths` from the plugin options ride on top, and the
 * bundler aliases win last; they mirror what the bundler will actually do at
 * resolve time.
 *
 * No `baseUrl` is emitted: TypeScript-Go removed the option (TS5102), and all
 * targets are absolute so none is needed.
 */
function createAliasCompilerOptions(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  tsconfig: string;
}): Record<string, unknown> {
  if (Object.keys(props.aliasPaths).length === 0) {
    return {};
  }
  return {
    paths: {
      ...readEffectiveTsconfigPaths(props.tsconfig),
      ...readPaths(props.compilerOptions.paths),
      ...props.aliasPaths,
    },
  };
}

function readPaths(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const output: Record<string, string[]> = {};
  for (const [key, paths] of Object.entries(value)) {
    if (!Array.isArray(paths)) {
      continue;
    }
    const filtered = paths.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (filtered.length !== 0) {
      output[key] = filtered;
    }
  }
  return output;
}

/**
 * Convert bundler aliases into absolute `paths` mappings.
 *
 * Targets are written as absolute paths on purpose: the generated tsconfig
 * lives in a system temp directory, where TypeScript-Go would reject bare
 * relative targets (TS5090) and anchor `./`-style ones at the wrong directory.
 */
function createAliasPaths(aliases: unknown): Record<string, string[]> {
  const paths: Record<string, string[]> = {};
  for (const alias of normalizeAliases(aliases)) {
    if (typeof alias.find !== "string" || alias.find.length === 0) {
      continue;
    }
    if (alias.find.includes("*")) {
      continue;
    }
    const key = alias.find.replace(/\/+$/, "");
    if (key.length === 0) {
      continue;
    }
    const target = normalizePath(
      path.isAbsolute(alias.replacement)
        ? alias.replacement
        : path.resolve(process.cwd(), alias.replacement),
    );
    paths[key] = [target];
    paths[`${key}/*`] = [`${target}/*`];
  }
  return paths;
}

function normalizeAliases(aliases: unknown): TtscTransformAlias[] {
  if (Array.isArray(aliases)) {
    return aliases.filter(isAlias);
  }
  if (typeof aliases === "object" && aliases !== null) {
    return Object.entries(aliases)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )
      .map(([find, replacement]) => ({ find, replacement }));
  }
  return [];
}

function createTransformCacheKey(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  tsconfig: string;
}): string {
  return stableStringify({
    aliasPaths: props.aliasPaths,
    compilerOptions: props.compilerOptions,
    plugins: props.plugins,
    tsconfig: pathIdentityKey(props.tsconfig),
  });
}

/**
 * JSON-serialise `value` with object keys sorted alphabetically.
 *
 * Standard `JSON.stringify` does not guarantee key ordering, so two
 * semantically identical option objects could produce different strings and
 * cause unnecessary cache misses. Sorting keys makes the cache key stable
 * regardless of the order properties were added to the options object.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRelativeSpecifier(value: string): boolean {
  return (
    value === "." ||
    value === ".." ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith(".\\") ||
    value.startsWith("..\\")
  );
}

function isAlias(value: unknown): value is TtscTransformAlias {
  return (
    typeof value === "object" &&
    value !== null &&
    "find" in value &&
    "replacement" in value &&
    typeof value.find === "string" &&
    typeof value.replacement === "string"
  );
}

/**
 * Extract the transformed source for a single file from the compiler result.
 *
 * Throws on compiler exception or hard failure so the bundler surfaces the
 * error to the user. On success, tries a fast exact-match lookup by
 * project-relative key first, then falls back to a resolve-based scan for the
 * rare case where the key in `result.typescript` uses an absolute or
 * differently-cased path.
 */
function selectTransformedSource(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string {
  if (props.result.type === "exception") {
    throw new Error(formatUnknownError(props.result.error));
  }
  if (props.result.type === "failure") {
    throw new Error(formatDiagnostics(props.result.diagnostics));
  }

  // Fast path: the compiler key matches the normalised project-relative path.
  const state = envelopeDerivation(props);
  const key = toProjectKey(
    props.projectRoot,
    props.file,
    state.identityContext,
  );
  const direct = props.result.typescript[key];
  if (direct !== undefined) {
    return direct;
  }
  // Slow path: the first-match identity index of the envelope's `typescript`
  // keys, built once per generation instead of scanned per delivery.
  const index = (state.outputIndex ??= createEnvelopeKeyIndex(
    state,
    props.projectRoot,
    props.result.typescript,
  ));
  const source = index.get(derivationIdentity(state, props.file));
  if (source !== undefined) {
    return source;
  }
  throw new Error(`ttsc transform did not return output for ${props.file}`);
}

/**
 * Forward non-fatal plugin diagnostics to stderr.
 *
 * A `success` result may still carry warnings or informational messages from
 * plugins. These are surfaced via stderr rather than throwing so the build
 * continues. Failures and exceptions are handled by the caller.
 */
function reportSuccessDiagnostics(result: ITtscCompilerTransformation): void {
  if (result.type !== "success" || result.diagnostics === undefined) {
    return;
  }
  const text = formatDiagnostics(result.diagnostics);
  if (text.length !== 0) {
    process.stderr.write(`${text}\n`);
  }
}

/**
 * Format a compiler diagnostic list into a human-readable string.
 *
 * Produces `"file: line:col: message"` entries joined by newlines, matching the
 * output style of `tsc`. When the list is empty (e.g. a failure with no
 * attached diagnostics) returns a generic fallback message so the thrown
 * `Error` is never empty.
 */
function formatDiagnostics(diagnostics: ITtscCompilerDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return "ttsc transform failed";
  }
  return diagnostics
    .map((diag) =>
      [
        diag.file ?? "ttsc",
        diag.line === undefined
          ? undefined
          : `${diag.line}:${diag.character ?? 1}`,
        diag.messageText,
      ]
        .filter((part) => part !== undefined && part !== "")
        .join(": "),
    )
    .join("\n");
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

/**
 * Locate the tsconfig that should govern the transform for `file`.
 *
 * If `tsconfig` is supplied it is returned as-is (absolute) or resolved from
 * `process.cwd()` (relative). Otherwise the function walks ancestor directories
 * starting at `file`'s directory, returning the first `tsconfig.json` found.
 * Falls back to `<cwd>/tsconfig.json` when no ancestor contains one; the
 * compiler will error if that file does not exist, which is the correct
 * behavior for a mis-configured project.
 */
function resolveTsconfig(
  file: string,
  tsconfig?: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string {
  if (tsconfig !== undefined) {
    return path.isAbsolute(tsconfig)
      ? tsconfig
      : path.resolve(process.cwd(), tsconfig);
  }

  let current = path.dirname(file);
  while (true) {
    const candidate = path.join(current, "tsconfig.json");
    if (filesystem.exists(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    // Reached filesystem root, stop walking.
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return path.resolve(process.cwd(), "tsconfig.json");
}

function toProjectKey(
  root: string,
  file: string,
  identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
): string {
  const rootKey = pathIdentityKey(root, identities);
  const fileKey = pathIdentityKey(file, identities);
  if (!identities.isWithin(root, file)) {
    return normalizePath(fileKey);
  }
  return normalizePath(fileKey.slice(rootKey.length).replace(/^[/\\]+/, ""));
}

/**
 * Build a comparison key for a path without changing the spelling handed to a
 * filesystem or bundler. Windows is case-insensitive; macOS is probed per
 * existing filesystem location so case-sensitive volumes keep distinct paths.
 */
export function pathIdentityKey(
  file: string,
  identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
): string {
  return identities.resolve(file).key;
}

function normalizePath(file: string): string {
  return file.replace(/\\/g, "/");
}
