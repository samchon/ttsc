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
  resolveFilesystemPath,
} from "ttsc/path-identity";
import type { TransformResult } from "unplugin";

import type { ResolvedTtscUnpluginOptions } from "./options";
import {
  findNearestProjectTsconfig,
  isIgnoredProjectDirectory,
} from "./projectDiscovery";
import {
  CONFIG_DIR_TEMPLATE_LIST_OPTIONS,
  CONFIG_DIR_TEMPLATE_SCALAR_OPTIONS,
  type ITtscProjectMembershipPolicy,
  PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
  absolutizePathsTarget,
  mergeMembershipPolicyOverlay,
  readEffectiveTsconfigPaths,
  readEffectiveTsconfigTemplateCompilerOptions,
  readEffectiveTsconfigTemplateFileSpecs,
  readProjectMembershipPolicy,
  readTsconfigSourceSnapshot,
  resolveConfigDirTemplatePath,
} from "./tsconfigPaths";

const TTSC_SEMANTIC_CONFIG_PATH = "TTSC_SEMANTIC_CONFIG_PATH";

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
 * One alias entry as the host declared it, before anything decides whether a
 * tsconfig `paths` map can express it.
 *
 * Both of Vite's spellings reach here, the `{ "@": "/src" }` object and the `{
 * find, replacement }` array, and only Vite's: `aliases` is populated in
 * `vite.configResolved` alone, and every other adapter passes `undefined`. (The
 * previous wording credited the object form to webpack and Rspack, which never
 * supply one.)
 *
 * `find` is `unknown` rather than `string` because Vite's array form accepts a
 * `RegExp`, and narrowing it here is what used to drop that form before the one
 * place that could report the drop ever saw it (samchon/ttsc#1315).
 */
interface TtscDeclaredAlias {
  /** The alias key, as declared: a module specifier prefix, or a `RegExp`. */
  find: unknown;
  /** Absolute or cwd-relative path that the alias points to. */
  replacement: string;
}

/** One directory's project-membership identity at generation time. */
interface TtscProjectDirectorySnapshot {
  /** Absolute directory spelling used by the project walk. */
  path: string;
  /**
   * Whether this directory's subtree can hold a program input.
   *
   * A directory that cannot is still walked and still watched, so a source
   * appearing in it later is noticed, but it takes no part in the membership
   * comparison. That is what lets a bundler create its output directory and
   * fill it without voiding a generation no compiler input touched, for any
   * output directory rather than for fifteen names (samchon/ttsc#1307).
   */
  relevant: boolean;
  /**
   * Digest of the entries the walk itself considers: every immediate child the
   * ignore list does not drop, with its kind.
   *
   * Deliberately not the directory's own metadata. A directory's stamp moves
   * whenever _any_ entry is added or removed, including the ones the walk
   * exists to ignore, so a bundler emitting into `dist/` — or merely creating
   * that directory for the first time — moved the project root's stamp and
   * voided a generation that no compiler input had touched. The ignore list
   * only protects the generation if the membership proof honours it too.
   */
  signature: string;
}

/** One project-walk observation that could not prove a coherent snapshot. */
interface TtscProjectWalkFailure {
  kind:
    | "directory-changed-during-walk"
    | "directory-metadata-unavailable"
    | "directory-read-failed"
    | "file-changed-during-read"
    | "file-read-failed";
  /** Absolute lexical spelling observed by the walk. */
  path: string;
}

/** Generation-scoped directory watchers used to detect membership changes. */
interface TtscProjectMutationTracker {
  /** Absolute paths named by generation-time mutation events. */
  changes: Set<string>;
  /** Whether additional event paths were discarded after the witness bound. */
  changesOmitted: boolean;
  close: () => void;
  /**
   * Absolute spellings whose creation, change or removal this tracker would
   * report, when it watches exact names rather than whole directories.
   *
   * A validation that finds an input here needs no filesystem call of its own:
   * the tracker is the evidence, and every path that leaves this set falls back
   * to being proven by hand. Empty for a tracker that watches directories as a
   * whole, which cannot answer for one name.
   */
  covered?: ReadonlySet<string>;
  /**
   * Wait until every event this tracker's watcher has already dispatched has
   * been applied to it.
   *
   * An in-process watcher drains on the next macrotask turn, because its
   * callbacks are already queued on this loop. A watcher living in the Windows
   * broker drains by round-trip instead: the child replies after its own turn,
   * and IPC preserves order, so the reply cannot overtake an event the child
   * had already sent (samchon/ttsc#1272).
   */
  drain?: () => Promise<void>;
  failed: boolean;
  membershipChanged: boolean;
  settle?: Promise<void>;
}

/** One reason a whole-project transform cannot become a reusable generation. */
interface TtscGenerationProofFailure {
  domain: "external" | "graph" | "host" | "project";
  /** Machine-readable failure class printed verbatim in terminal diagnostics. */
  kind: string;
  /** Optional producer detail, such as the native compiler observation failure. */
  detail?: string;
  /** Absolute lexical spelling of the input or directory that failed proof. */
  path?: string;
}

/** Bounded proof witnesses for one transform attempt. */
interface TtscGenerationProofFailures {
  entries: TtscGenerationProofFailure[];
  omitted: number;
  seen: Set<string>;
}

/** Filesystem state that may authorize replacing one terminal failed generation. */
interface TtscFailedGenerationValidation {
  /** Last attempted generation, retained only as a comparison baseline. */
  cached: TtscCachedProjectTransform;
  /** Input keys whose content can affect the generation, or the whole walk. */
  declaredInputs: ReadonlySet<string> | undefined;
  /** Fingerprints of every out-of-walk and exact host input. */
  inputStates: ReadonlyMap<string, string>;
  /** Unmodified on-disk project hashes before the in-memory source overlay. */
  projectInputHashes: Readonly<Record<string, string>>;
  /** Coherence and exact failure state of the final project walk. */
  projectWalkComplete: boolean;
  projectWalkFailures: string;
}

/**
 * A verdict about one generation that later deliveries replay instead of
 * repeating the whole compile behind it.
 *
 * The two kinds are replayed on different evidence, and each carries its own: a
 * pass verdict knows the pass it belongs to, and an unstable generation knows
 * the recorded environment it was proven against.
 */
abstract class TtscTerminalGenerationError extends Error {}

/**
 * The compile succeeded and produced no output for one requested module,
 * because the program does not contain it.
 *
 * Not a terminal generation error, and deliberately not a build failure. It is
 * a fact about one file, and the answer to it is to leave that file to the host
 * (samchon/ttsc#1308). It is a distinct type rather than a message match so the
 * decision travels as a type: `@ttsc/metro` used to recognise this case by
 * searching the message text for "did not return output", which is how one
 * product came to hold two different answers to one condition.
 */
class TtscMissingProgramOutputError extends Error {
  /** The module the bundler asked for. */
  public readonly file: string;
  /** The project config whose program does not contain it. */
  public readonly tsconfig: string;
  public constructor(file: string, tsconfig: string) {
    super(
      `ttsc: ${file} is not part of the program described by ${tsconfig}, so it was left untransformed. Add it to that project's "include" if ttsc plugins should apply to it.`,
    );
    this.name = "TtscMissingProgramOutputError";
    this.file = file;
    this.tsconfig = tsconfig;
  }
}

/**
 * A bounded proof failure that stays authoritative until its inputs change.
 *
 * This is the adapter failing to _obtain_ a coherent snapshot — a race it lost
 * — so a later attempt may well succeed with the same inputs. It is retried
 * when its recorded environment moves, and a new delivery epoch grants it the
 * one fresh attempt the per-pass cache clear used to give it
 * (samchon/ttsc#1300).
 */
class TtscUnstableGenerationError extends TtscTerminalGenerationError {
  public readonly validation: TtscFailedGenerationValidation;

  public constructor(
    message: string,
    validation: TtscFailedGenerationValidation,
  ) {
    super(message);
    this.name = "TtscUnstableGenerationError";
    this.validation = validation;
  }
}

/**
 * A compile this pass already attempted, whose envelope failed outright.
 *
 * The envelope cannot say whether the host reported diagnostics about the
 * project or failed to run at all: an ordinary type error arrives as an
 * `"exception"` carrying the compiler's own diagnostic text, exactly as a
 * crashed host would. Sniffing that message to tell the two apart would be a
 * guess, so the adapter uses the one boundary it genuinely owns. Inside a pass
 * the answer is already settled, so every later module replays it instead of
 * repeating a whole-project transform to reach the same verdict, which is what
 * made a single broken save cost one compile per delivered module
 * (samchon/ttsc#1303).
 *
 * The scope is exactly the pass. A host whose `buildStart` repeats drops the
 * verdict at its next rebuild, so a transient host failure costs that one
 * rebuild. A host with no pass boundary never retains one at all and keeps
 * retrying on its very next delivery. Between them sits a host that opens
 * exactly one pass for its whole process — Bun's runtime plugin, and a Vite dev
 * server configured with `server.watch: null` — where the verdict lasts the
 * session. That follows from what those hosts already publish about themselves,
 * that their session is one immutable load session and the remedy for changed
 * inputs is to restart, and it is the deliberate trade: without it, one type
 * error costs such a session a whole-project compile per delivered module,
 * which is the workload samchon/ttsc#970 is about.
 *
 * It carries the original error's message, stack and `cause` rather than
 * replacing them, so what a bundler reports is what it reported before the
 * verdict existed.
 */
class TtscPassVerdictError extends TtscTerminalGenerationError {
  /** The delivery pass this verdict belongs to, and its whole scope. */
  public readonly epoch: number;

  public constructor(original: unknown, epoch: number) {
    super(
      original instanceof Error
        ? original.message
        : formatUnknownError(original),
      { cause: original },
    );
    if (original instanceof Error) {
      this.name = original.name;
      if (original.stack !== undefined) this.stack = original.stack;
    } else {
      this.name = "TtscPassVerdictError";
    }
    this.epoch = epoch;
  }
}

/** Proof witnesses retained beside a compiler result without extending its API. */
const TRANSFORM_GENERATION_FAILURES = new WeakMap<
  ITtscCompilerTransformation,
  TtscGenerationProofFailures
>();

/** Retry baselines retained only for attempts that could not be published. */
const TRANSFORM_FAILED_GENERATION_VALIDATIONS = new WeakMap<
  ITtscCompilerTransformation,
  TtscFailedGenerationValidation
>();

/** Internal retained clock-probe ownership for published generations. */
const TRANSFORM_CLOCK_REFERENCE_DIRECTORIES = new WeakMap<
  TtscCachedProjectTransform,
  string
>();

/** Cache promises whose unchanged terminal verdict may be replayed. */
const TERMINAL_TRANSFORM_GENERATIONS = new WeakMap<
  Promise<TtscCachedProjectTransform>,
  TtscTerminalGenerationError
>();

/** Maximum witnesses printed and retained for each failed transform attempt. */
const MAX_GENERATION_PROOF_FAILURES = 8;

/** Maximum exact mutation paths kept after a tracker already proved a change. */
const MAX_GENERATION_MUTATION_PATHS = 8;

/** One retry absorbs a transient watch write without admitting an infinite loop. */
const TRANSFORM_GENERATION_ATTEMPTS = 2;

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
  /** Predicate-preserving compiler proofs for external candidate spellings. */
  externalInputObservations?: Record<
    string,
    ITtscCompilerTransformation.IInputObservation
  >;
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
   * proved its {@link externalInputHashes} entry and recorded only once the
   * observed filesystem's clock provably left the stamp's tick
   * ({@link stampSeparable}). An input whose signature still holds carries the
   * recorded content, so revalidation may skip the read.
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
   * What the resolved configuration admitted into this generation's program.
   *
   * Recorded per generation rather than read per validation because it is a
   * property of the configuration the compile ran under, so a later delivery
   * must judge membership by the same rule the compile did. A tsconfig edit
   * that changes the rule also changes a declared input, which replaces the
   * generation and its policy together.
   */
  membershipPolicy: ITtscProjectMembershipPolicy;
  /**
   * Files already reported as absent from the program, and the pass that
   * reporting belongs to, so the notice is one per file per pass rather than
   * one per delivery.
   */
  missingOutputReported?: Set<string>;
  missingOutputEpoch?: number;
  /**
   * The project config this generation compiled, so a module the program does
   * not contain can be told which program that was.
   */
  tsconfig: string;
  /**
   * Metadata signature of each {@link inputHashes} entry whose hash was proven
   * against an unracing read of the file on disk, in a tick the observed
   * filesystem's clock had provably left ({@link stampSeparable}).
   *
   * The generation's own current file is absent at capture: its recorded hash
   * comes from the bundler's in-memory source, so the walk that produced it
   * compared nothing. A later delivery of a sibling does compare that file's
   * disk bytes against the recorded hash, and may record a signature then.
   */
  inputSignatures?: Record<string, string>;
  /**
   * Raw source hash of every readable key in the transform output, keyed by
   * filesystem identity. Unlike {@link inputHashes}, this includes source
   * outputs outside the project walk without adding arbitrary output keys to
   * the complete project snapshot.
   */
  sourceHashes?: Record<string, string>;
  /** Metadata snapshot of every directory in the stable generation walk. */
  projectDirectories?: TtscProjectDirectorySnapshot[];
  /** Live notification state for universal host-input changes. */
  hostInputMutationTracker?: TtscProjectMutationTracker;
  /**
   * Live notification state for the generation's absent resolution candidates
   * and the directories that carry them.
   *
   * Separate from the universal-input tracker because it listens for a
   * different thing. Every event that can make an absent candidate present is a
   * rename — the file appearing, a component of the path being created,
   * replaced, or retargeted — so a change event on one of these names is never
   * evidence this tracker exists to collect. What it is, on a backend that
   * reports a write below a directory as a change to that directory's own entry
   * (Windows does), is a dev server's steady traffic: listening for every event
   * would replace the generation each time a bundler wrote inside
   * `node_modules`. The filter therefore drops noise without dropping proof.
   * The one appearance it cannot see is a Windows junction retargeted in place
   * through `FSCTL_SET_REPARSE_POINT`, which no mainstream tool does; every
   * package manager replaces the entry instead, which is a rename.
   */
  candidateMutationTracker?: TtscProjectMutationTracker;
  /**
   * Universal descriptor/config inputs proven once at generation time, then by
   * metadata.
   *
   * Recorded state of the generation, like the input hashes and the directory
   * snapshot beside it, rather than state derived from the envelope: an entry
   * carries the manifest that proved it, so nothing can present one
   * generation's recorded inputs under another envelope's proof.
   */
  hostInputValidation?: TtscHostInputValidation;
  /** Live notification state for file/directory creation, deletion, and rename. */
  projectMutationTracker?: TtscProjectMutationTracker;
  /** Whether a generated wrapper and its source config graph stayed coherent. */
  configStateComplete?: boolean;
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
   * The delivery epoch this generation is currently settled against, or
   * `undefined` for a generation no epoch has proven.
   *
   * Set when the generation is compiled, and again whenever a later epoch's
   * first delivery proves the whole generation still matches the filesystem.
   * While it equals the cache's current epoch, each module's first delivery is
   * settled by the supplied source alone, exactly as it was when every pass
   * compiled its own generation (samchon/ttsc#1300).
   */
  deliveryEpoch?: number;
  /**
   * Whether this generation's non-error diagnostics have been surfaced at all,
   * and the epoch they were last surfaced in.
   *
   * The diagnostics describe one compile of one program, so they belong to the
   * generation rather than to a delivery; a pass that reuses a retained
   * generation still surfaces them once, because a build's warnings are part of
   * what that build reports (samchon/ttsc#1304). The two fields are separate so
   * a persistent host, whose epoch is `undefined`, still reports the first
   * time.
   */
  diagnosticsReported?: boolean;
  diagnosticsEpoch?: number;
  /**
   * Files already delivered from this generation, keyed by filesystem identity.
   * A cache with a delivery epoch uses this to skip persistent validation only
   * for a module's first delivery inside the current pass; the set is cleared
   * whenever a new epoch's gate re-proves the generation.
   */
  servedFiles?: Set<string>;
  /**
   * Absolute path of the adapter-owned scratch directory used for this
   * generation. It is disposed after compilation, so none of its compiler,
   * resolver, or plugin artifacts can be a persistent cache or watch input.
   */
  scratchDirectory?: string;
  /**
   * Absolute path of the generated temp-dir tsconfig this compile ran against,
   * when an alias/compiler-options overlay required one. The compiler reports
   * it in the envelope's `graph.configs` chain, but it is disposed right after
   * the compile, so registering it as a watch input would invalidate every
   * bundler cache snapshot on the next build; watch derivation must skip this
   * path. {@link scratchDirectory} owns the wider disposable-input bound.
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
   *
   * Supplying one replaces the Windows broker as well, so an embedder that
   * wraps Node's own `fs.watch` there gives up the isolation that contains the
   * native abort Node's Windows fs-event backend can raise when a watched
   * temporary tree is deleted.
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
 * The current delivery epoch of each cache whose owner has declared a real
 * per-pass lifecycle by calling {@link beginTtscTransformBuild}.
 *
 * A _delivery epoch_ is one bundler pass: the window inside which each module
 * is requested at most once, so its first delivery may be settled against the
 * state the pass started from. It is deliberately not the same fact as whether
 * the generation is still valid, which the recorded snapshot answers.
 * Conflating the two is what made every host with a repeating `buildStart` —
 * webpack and Rspack watch, Rollup and Rolldown watch, `vite build --watch`,
 * esbuild rebuild — discard a perfectly good whole-project compile on every
 * edit (samchon/ttsc#1300).
 *
 * Absent from the map means persistent validation: a host with no pass boundary
 * at all (a watching Vite dev server, Metro, the Turbopack loader), where every
 * delivery proves the generation for itself.
 */
const TRANSFORM_CACHE_EPOCHS = new WeakMap<TtscTransformCache, number>();

/** The pass a delivery belongs to, or `undefined` under persistent validation. */
function transformCacheEpoch(
  cache: TtscTransformCache | undefined,
): number | undefined {
  return cache === undefined ? undefined : TRANSFORM_CACHE_EPOCHS.get(cache);
}

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
 * Open a new delivery pass, enabling constant-time first delivery for every
 * module this pass asks for.
 *
 * This deliberately retains the cached generation. The pass boundary is a
 * statement about _deliveries_ — each module is requested at most once inside
 * it — not about whether the compiled program is still correct, which the
 * generation's own recorded snapshot answers and which
 * {@link matchesCachedSource} proves once at the pass's first delivery. Clearing
 * here instead made a host whose `buildStart` repeats recompile the whole
 * project on every rebuild even when no compiler input had changed
 * (samchon/ttsc#1300). Use {@link resetTtscTransformCache} to actually discard a
 * generation and its watchers.
 *
 * Hosts without a guaranteed pass boundary use persistent validation unless
 * they have another immutable lifecycle. Bun runtime setup, for example,
 * defines one process-scoped module-loading session.
 */
export function beginTtscTransformBuild(cache: TtscTransformCache): void {
  TRANSFORM_CACHE_EPOCHS.set(
    cache,
    (TRANSFORM_CACHE_EPOCHS.get(cache) ?? 0) + 1,
  );
}

/**
 * Discard every generation, dispose its watchers, and return the cache to
 * persistent validation mode.
 *
 * This is the unconditional lifecycle boundary, and it is distinct from
 * {@link beginTtscTransformBuild}: a pass ending is not a reason to throw a
 * proven compile away, while a session ending is.
 */
export function resetTtscTransformCache(cache: TtscTransformCache): void {
  clearTtscTransformCache(cache);
  TRANSFORM_CACHE_EPOCHS.delete(cache);
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
 * What the generation already knows about one derived watch input, handed to
 * the adapter so it does not rederive it per input per delivery.
 *
 * All facts are generation state: the identity is the memoized
 * {@link pathIdentityKey} of the input, `missing` preserves the original public
 * existence contract, and `unavailable` distinguishes a failed file predicate
 * from ordinary absence. An adapter that computes them itself pays a
 * `realpath`, a case-sensitivity directory listing, and an `existsSync` for
 * every input of every delivered module, which is O(modules x inputs) for one
 * build (samchon/ttsc#1246).
 */
export interface TtscWatchInputEvidence {
  /** Memoized filesystem identity of the input. */
  identity: string;
  /** Whether the generation recorded this input as unavailable as a file. */
  missing: boolean;
  /** The generation state Metro can compare with its main-process baseline. */
  state?: TtscWatchInputState;
  /** Which unavailable predicate must become true before invalidation. */
  unavailable?: "missing" | "not-file";
}

/** Exact generation state behind one derived watch input. */
export type TtscWatchInputState =
  | {
      /** A project-walk or dependency-only input read as ordinary host bytes. */
      codec: "host";
      hash: string;
    }
  | {
      /** A realized compiler-graph input, including its physical target. */
      codec: "graph";
      hash: string;
      realpath: string | null;
    }
  | {
      /** The exact compiler predicates observed for a resolver input. */
      codec: "predicates";
      observation: ITtscCompilerTransformation.IInputObservation;
    };

/** Main-process file predicate used only by project discovery. */
export interface TtscWatchInputFileBaseline {
  fileExists: boolean;
  identity: string;
}

/** Main-process state broad enough to compare every watch-input codec. */
export interface TtscWatchInputBaseline extends TtscWatchInputFileBaseline {
  directoryExists: boolean;
  graphHash: string;
  graphReadHash: string | null;
  hostHash: string;
  realpath: { ok: false; path?: never } | { ok: true; path: string };
  stat: "directory" | "file" | "missing";
}

/** Baseline shape stored for either a discovery predicate or a full input. */
export type TtscWatchInputKeyBaseline =
  | TtscWatchInputFileBaseline
  | TtscWatchInputBaseline;

/** One derived input and its optional generation proof. */
export interface TtscWatchInput {
  evidence?: TtscWatchInputEvidence;
  file: string;
}

/**
 * Hooks the bundler adapter passes into {@link transformTtsc} so transform
 * side-channels (plugin-reported dependencies and host resolver inputs) reach
 * the bundler without leaking extra fields on the returned `TransformResult`.
 */
export interface TtscTransformHooks {
  /**
   * Invoked once per absolute watch-input path derived for the transformed file
   * `F`: the plugin-reported `dependencies[F]` list unioned with the host-owned
   * reference graph's contribution — the reachability closure of `graph.edges`
   * from `F`, the `graph.globals` files, the `graph.configs` chain, importer
   * `graph.candidates`, and universal `graph.resolutionInputs`. For a file the
   * envelope declared `dependenciesComplete`, only `dependencies[F]`,
   * `graph.candidates`, `graph.resolutionInputs`, and the universal
   * `graph.configs` chain remain. Adapters forward this to the bundler's
   * `addWatchFile` so type-only inputs participate in watch-mode and
   * persistent-cache invalidation. See {@link selectWatchInputs} for the exact
   * derivation.
   */
  addWatchFile?: (file: string, evidence?: TtscWatchInputEvidence) => void;
  /**
   * Batched form of {@link addWatchFile}. When supplied, the transform calls it
   * once per delivered module and does not call `addWatchFile` for that
   * module.
   */
  addWatchFiles?: (inputs: readonly TtscWatchInput[]) => void;
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
 * @param aliases - Raw Vite alias configuration (object or array).
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
    // Read once per iteration, before the cache is consulted, so a delivery
    // belongs to the pass that was current when it started examining the
    // generation. A pass opened while this one awaits an in-flight compile is
    // picked up by the next iteration, which is the one that runs when the
    // entry it awaited turns out to have been superseded.
    const epoch = transformCacheEpoch(cache);
    let transformed = cache?.get(key);
    if (transformed !== undefined) {
      const terminal = TERMINAL_TRANSFORM_GENERATIONS.get(transformed);
      if (terminal !== undefined) {
        // A terminal verdict is an answer about one observed environment, not an
        // invitation for every later module to repeat the whole compile.
        if (
          replaysTerminalGeneration(terminal, epoch, {
            currentFile: file,
            currentSource: source,
            filesystem,
          })
        ) {
          throw terminal;
        }
        evictGeneration(cache, key, transformed);
        if (cache?.get(key) !== undefined) {
          continue;
        }
        transformed = undefined;
      }
    }
    if (transformed !== undefined) {
      const cached = await awaitOrEvict(cache, key, transformed);
      TRANSFORM_RESULT_FILESYSTEM.set(cached.result, filesystem);
      // While this caller awaited the old Promise, another caller may have
      // invalidated it and installed a newer authoritative generation.
      if (cache?.get(key) !== transformed) {
        continue;
      }
      if (epoch === undefined) {
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
        matchesCachedSource(cached, file, source, epoch)
      ) {
        reportSuccessDiagnostics(cached, epoch);
        // A resolved `"exception"` / `"failure"` envelope makes this throw;
        // that is a failed generation too, so it is retained for this pass or
        // evicted outside one before being surfaced.
        let code: string;
        try {
          code = selectOrEvict(cache, key, transformed, epoch, {
            file,
            projectRoot: cached.projectRoot,
            result: cached.result,
            tsconfig: cached.tsconfig,
          });
        } catch (error) {
          if (!(error instanceof TtscMissingProgramOutputError)) {
            notifyFailedGenerationInputs(hooks, cached);
            throw error;
          }
          // The compile is fine and simply has nothing for this module, so the
          // module goes back to the host untransformed rather than failing the
          // build (samchon/ttsc#1308). Its project config and selection inputs
          // still decide whether a later generation will contain this module,
          // so hosts must receive the same universal watch-input batch.
          reportMissingProgramOutput(cached, error, epoch);
          notifyWatchInputs(hooks, cached, file);
          markCachedSourceServed(cached, file);
          return undefined;
        }
        notifyWatchInputs(hooks, cached, file);
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
        // Stamp the pass this compile was started for, not the one it happens
        // to finish in: a boundary crossed mid-compile leaves the generation
        // belonging to the earlier pass, so the next pass re-proves it.
        deliveryEpoch: epoch,
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
    const { projectRoot, result } = cached;
    reportSuccessDiagnostics(cached, epoch);
    let code: string;
    try {
      code = selectOrEvict(cache, key, generation, epoch, {
        file,
        projectRoot,
        result,
        tsconfig: cached.tsconfig,
      });
    } catch (error) {
      if (!(error instanceof TtscMissingProgramOutputError)) {
        notifyFailedGenerationInputs(hooks, cached);
        throw error;
      }
      reportMissingProgramOutput(cached, error, epoch);
      notifyWatchInputs(hooks, cached, file);
      markCachedSourceServed(cached, file);
      return undefined;
    }
    notifyWatchInputs(hooks, cached, file);
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
 * Await a cached generation, retaining only terminal proof failures.
 *
 * The cache stores the in-flight transform Promise before it settles so
 * concurrent callers share one compilation. Ordinary compiler and host
 * rejections are evicted so a transient failure cannot become permanent. A
 * bounded stabilization failure is different: it already spent its retry and
 * repeating it for every later module recreates the issue this gate prevents.
 * It stays authoritative until its retained input baseline changes or the cache
 * owner starts a new lifecycle.
 */
async function awaitOrEvict(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
): Promise<TtscCachedProjectTransform> {
  try {
    return await generation;
  } catch (error) {
    if (
      error instanceof TtscUnstableGenerationError &&
      cache?.get(key) === generation
    ) {
      TERMINAL_TRANSFORM_GENERATIONS.set(generation, error);
    } else {
      evictGeneration(cache, key, generation);
    }
    throw error;
  }
}

/**
 * Extract the transformed source, and decide what a throwing generation is.
 *
 * {@link selectTransformedSource} throws for two different reasons, and only one
 * of them is about the generation. A host `"exception"` or a compiler
 * `"failure"` means the compile produced nothing for anyone: inside a pass that
 * verdict is retained and replayed, because evicting it made every remaining
 * module repeat the whole-project transform only to reach the identical answer
 * (samchon/ttsc#1303), and outside a pass it keeps being evicted so a
 * long-lived worker retries on its very next delivery exactly as before.
 *
 * A `"success"` envelope that has no output for the module asking is the other
 * reason, and it is a fact about that one file: an ordinary condition for a
 * module the bundle reaches and the tsconfig program does not contain. It is
 * neither retained nor evicted. The error reaches the caller, and the
 * generation, which compiled perfectly well for every other module, stays.
 */
function selectOrEvict(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
  epoch: number | undefined,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
    tsconfig: string;
  },
): string {
  try {
    return selectTransformedSource(props);
  } catch (error) {
    const verdict = retainPassVerdict(
      cache,
      key,
      generation,
      epoch,
      props.result,
      error,
    );
    if (verdict !== undefined) {
      throw verdict;
    }
    // A generation that compiled fine and simply has no output for the module
    // asking is not a failed generation. Discarding it made every later module
    // recompile the whole project to reach the same answer, which is the cost
    // samchon/ttsc#1303 is about, for a bundle that merely reaches a file the
    // tsconfig program does not contain.
    if (props.result.type !== "success") {
      evictGeneration(cache, key, generation);
    }
    throw error;
  }
}

/**
 * Retain the verdict of a compile this pass already attempted, or return
 * `undefined` when nothing may be retained.
 *
 * Only inside a delivery pass. A pass is the window in which every delivery is
 * settled against the state the pass started from, so an attempt it already
 * made is part of that state and the remaining modules replay it rather than
 * each repeating a whole-project transform to reach the same answer. Outside a
 * pass there is no such window, and a long-lived worker must keep retrying on
 * its very next delivery so a transient host failure never becomes permanent.
 */
function retainPassVerdict(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
  epoch: number | undefined,
  result: ITtscCompilerTransformation,
  error: unknown,
): TtscTerminalGenerationError | undefined {
  // Only an envelope that failed outright is a statement about the generation.
  // `selectTransformedSource` also throws for a file the compile simply has no
  // output for, which is an ordinary condition for a module the bundle reaches
  // but the tsconfig program does not contain, and which says nothing about the
  // other modules. Retaining that would fail the whole pass, naming a file none
  // of them asked about.
  if (
    result.type === "success" ||
    epoch === undefined ||
    cache?.get(key) !== generation
  ) {
    return undefined;
  }
  const existing = TERMINAL_TRANSFORM_GENERATIONS.get(generation);
  if (existing !== undefined) {
    return existing;
  }
  const verdict = new TtscPassVerdictError(error, epoch);
  TERMINAL_TRANSFORM_GENERATIONS.set(generation, verdict);
  return verdict;
}

/**
 * Whether a terminal verdict still answers for this delivery.
 *
 * Inside the pass that produced or confirmed it, it is replayed without
 * re-probing anything: the pass settles every delivery against the state it
 * started from, so re-walking the project once per module would spend exactly
 * the cost this gate exists to remove.
 *
 * Across passes the two kinds part company. A pass verdict is dropped, because
 * a new pass is the first boundary at which the host itself claims something
 * may have changed, and the compile it stood for was never proven against a
 * recorded environment. An unstable generation was, so it keeps its own rule:
 * one fresh attempt per pass, and otherwise replayed until that recorded
 * environment provably moves.
 */
function replaysTerminalGeneration(
  terminal: TtscTerminalGenerationError,
  epoch: number | undefined,
  props: {
    currentFile: string;
    currentSource: string;
    filesystem: TtscTransformFilesystemOperations;
  },
): boolean {
  if (terminal instanceof TtscPassVerdictError) {
    // A pass verdict has no recorded environment to re-confirm against, so the
    // pass that produced it is its whole scope.
    return epoch !== undefined && terminal.epoch === epoch;
  }
  if (!(terminal instanceof TtscUnstableGenerationError)) {
    return false;
  }
  // An unstable generation does have one, and confirming it per delivery is the
  // behaviour its own contract describes, so the pass does not cache that
  // answer. A new pass still grants the fresh attempt the per-pass cache clear
  // used to give it.
  if (
    epoch !== undefined &&
    terminal.validation.cached.deliveryEpoch !== epoch
  ) {
    return false;
  }
  return !failedGenerationEnvironmentChanged(terminal.validation, props);
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

/** Release one generation's watchers and retained clock probe exactly once. */
function disposeCachedTransform(cached: TtscCachedProjectTransform): void {
  const trackers = [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ];
  cached.projectMutationTracker = undefined;
  cached.hostInputMutationTracker = undefined;
  cached.candidateMutationTracker = undefined;
  const clockReferenceDirectory =
    TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.get(cached);
  TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.delete(cached);
  for (const tracker of trackers) {
    try {
      tracker?.close();
    } catch {
      // Disposal is scheduled behind fulfilled generation Promises, so it has
      // no caller that can recover from a close failure. Keep releasing every
      // independent resource and leave no rejected cleanup Promise behind.
    }
  }
  if (clockReferenceDirectory !== undefined) {
    disposeFilesystemClockReference(clockReferenceDirectory);
  }
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
  /** Per lexical delivered-module spelling memo of its final watch-input list. */
  readonly watchInputs: Map<string, string[]>;
  /**
   * Lazily built project-walk keys of the envelope's declared inputs, and
   * whether that build already ran. A graph-free envelope declares no input
   * set, so `undefined` after a completed build means "compare the whole walk";
   * see {@link sameHashes}.
   */
  declaredInputKeys?: Set<string>;
  declaredInputKeysBuilt?: boolean;
}

interface TtscHostInputValidation {
  /** Lexical input spellings that existed when the generation was captured. */
  readonly entries: Map<
    string,
    {
      path: string;
      /**
       * Whether the recorded state of this input came from reading its bytes.
       * An input that existed but could not be read records a missing state, so
       * no signature may stand in for it: its metadata holds still while the
       * bytes behind it appear.
       */
      readable: boolean;
      realpath: string | null;
      /**
       * The signature that may stand in for this entry's content comparison, or
       * `undefined` when none may. A blocker keeps one regardless: it proves a
       * kind and an identity rather than content.
       */
      signature: string | undefined;
      strict?: true;
    }
  >;
  /**
   * Lexical spellings the manifest accounts for, omitted from the per-module
   * dependency loop below.
   *
   * Spellings, not identities: a symlink and its target share one identity but
   * are two inputs, and skipping the alias because the manifest proved the
   * target would leave the alias's own retarget unvalidated.
   */
  readonly covered: Set<string>;
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
  /** Importer-owned resolver-input entries, sources pre-identified. */
  readonly candidates: { source: string; files: string[] }[];
  /** Resolved absolute `graph.globals` and `graph.configs` members. */
  readonly globals: string[];
  readonly configs: string[];
  /** Resolver inputs whose state affects every source file. */
  readonly resolutionInputs: string[];
  /** Every realized or resolver-input path, keyed by lexical spelling. */
  readonly memberSpellings: Set<string>;
  /**
   * Predicate-only resolver inputs, keyed by absolute lexical spelling. These
   * are exact compiler calls but need not carry file content, for example a
   * failed file predicate or automatic type-root directory enumeration. A path
   * that is also a realized edge, global, config, or source keeps the stronger
   * realized-file standard.
   */
  readonly speculative: Set<string>;
  /** Compiler-time legacy proof keyed by absolute lexical spelling. */
  readonly inputProofs: Map<
    string,
    { hash: string | null; path: string; realpath: string | null }
  >;
  /** Native compiler-observation failure keyed by absolute lexical spelling. */
  readonly inputProofFailures: Map<string, string>;
  /** Graph proof spellings that reported contradictory generation states. */
  readonly inputProofConflicts: Set<string>;
  /** Predicate-preserving proofs keyed by absolute lexical spelling. */
  readonly inputObservations: Map<
    string,
    ITtscCompilerTransformation.IInputObservation
  >;
  /** Absolute spellings whose predicate proof is malformed or contradictory. */
  readonly inputObservationConflicts: Set<string>;
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
  const platform = resultFilesystem(props.result).platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const built: TtscEnvelopeGraphIndexes = {
    edges: new Map(),
    spellings: new Map(),
    candidates: [],
    globals: [],
    configs: [],
    resolutionInputs: [],
    memberSpellings: new Set(),
    speculative: new Set(),
    inputProofs: new Map(),
    inputProofFailures: new Map(),
    inputProofConflicts: new Set(),
    inputObservations: new Map(),
    inputObservationConflicts: new Set(),
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
      built.memberSpellings.add(absolute);
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
            const targetIdentity = derivationIdentity(state, absoluteTarget);
            built.memberSpellings.add(absoluteTarget);
            if (!built.spellings.has(targetIdentity)) {
              built.spellings.set(targetIdentity, absoluteTarget);
            }
            return absoluteTarget;
          }),
      );
      built.edges.set(identity, entries);
    }
    built.globals.push(...selectListedFiles(props.projectRoot, graph.globals));
    built.configs.push(...selectListedFiles(props.projectRoot, graph.configs));
    for (const input of [...built.globals, ...built.configs]) {
      const identity = derivationIdentity(state, input);
      built.memberSpellings.add(path.resolve(input));
      if (!built.spellings.has(identity)) built.spellings.set(identity, input);
    }
    const candidateEntries = Object.entries(graph.candidates ?? {}).filter(
      (entry) => Array.isArray(entry[1]),
    );
    // Every candidate source is an importing file the compiler read, so fold
    // the sources in before classifying any candidate. Otherwise one entry's
    // candidate could be classified speculative before a later entry proves
    // the same path is a realized source.
    for (const [source] of candidateEntries) {
      const absoluteSource = path.resolve(props.projectRoot, source);
      const identity = derivationIdentity(state, absoluteSource);
      built.memberSpellings.add(absoluteSource);
      if (!built.spellings.has(identity)) {
        built.spellings.set(identity, absoluteSource);
      }
    }
    const realized = new Set(built.memberSpellings);
    built.resolutionInputs.push(
      ...selectListedFiles(props.projectRoot, graph.resolutionInputs),
    );
    for (const input of built.resolutionInputs) {
      const spelling = path.resolve(input);
      const identity = derivationIdentity(state, input);
      if (!realized.has(spelling)) built.speculative.add(spelling);
      built.memberSpellings.add(spelling);
      if (!built.spellings.has(identity)) built.spellings.set(identity, input);
    }
    for (const [source, candidates] of candidateEntries) {
      built.candidates.push({
        source: derivationIdentity(
          state,
          path.resolve(props.projectRoot, source),
        ),
        files: selectListedFiles(props.projectRoot, candidates),
      });
      for (const candidate of candidates) {
        if (typeof candidate !== "string" || candidate.length === 0) continue;
        const absoluteCandidate = path.resolve(props.projectRoot, candidate);
        const identity = derivationIdentity(state, absoluteCandidate);
        // Edges, globals, configs, and every candidate source are folded in
        // above, so a path absent from that set is one the envelope reported
        // only as a candidate.
        if (!realized.has(absoluteCandidate)) {
          built.speculative.add(absoluteCandidate);
        }
        built.memberSpellings.add(absoluteCandidate);
        if (!built.spellings.has(identity)) {
          built.spellings.set(identity, absoluteCandidate);
        }
      }
    }
    const transformSourceSpellings = new Set<string>();
    if (props.result.type === "success") {
      for (const output of Object.keys(props.result.typescript)) {
        if (!isDeclarationFile(output)) {
          const absoluteOutput = path.resolve(props.projectRoot, output);
          transformSourceSpellings.add(absoluteOutput);
        }
      }
    }
    for (const [input, reported] of Object.entries(
      graph.inputObservations ?? {},
    )) {
      if (input.length === 0) continue;
      const absolute = path.resolve(props.projectRoot, input);
      const spelling = path.resolve(absolute);
      if (
        !built.memberSpellings.has(spelling) &&
        !transformSourceSpellings.has(spelling)
      ) {
        continue;
      }
      const normalized = normalizeGraphInputObservation(reported, platform);
      if (normalized === undefined) {
        built.inputObservationConflicts.add(spelling);
        if (!built.inputProofFailures.has(spelling)) {
          built.inputProofFailures.set(spelling, "malformed-observation");
        }
        continue;
      }
      const previous = built.inputObservations.get(spelling);
      const merged =
        previous === undefined
          ? normalized
          : mergeGraphInputObservations(previous, normalized);
      if (merged === undefined) {
        built.inputObservations.delete(spelling);
        built.inputObservationConflicts.add(spelling);
        if (!built.inputProofFailures.has(spelling)) {
          built.inputProofFailures.set(spelling, "conflicting-observation");
        }
      } else if (!built.inputObservationConflicts.has(spelling)) {
        built.inputObservations.set(spelling, merged);
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
          !pathApi.isAbsolute(reportedRealpath))
      ) {
        continue;
      }
      const absolute = path.resolve(props.projectRoot, input);
      const spelling = path.resolve(absolute);
      if (
        !built.memberSpellings.has(spelling) &&
        !transformSourceSpellings.has(spelling)
      ) {
        continue;
      }
      const proof = {
        hash,
        path: absolute,
        realpath:
          reportedRealpath === null
            ? null
            : resolveFilesystemPath(reportedRealpath, platform),
      };
      const previous = built.inputProofs.get(spelling);
      if (
        previous !== undefined &&
        (previous.hash !== proof.hash ||
          !sameHostInputRealpath(
            previous.realpath,
            proof.realpath,
            state.identityContext,
          ))
      ) {
        built.inputProofs.delete(spelling);
        built.inputProofConflicts.add(spelling);
      } else if (!built.inputProofConflicts.has(spelling)) {
        built.inputProofs.set(spelling, proof);
      }
    }
    for (const [input, reason] of Object.entries(
      graph.inputProofFailures ?? {},
    )) {
      if (typeof reason !== "string" || !/^[a-z0-9-]{1,64}$/.test(reason)) {
        continue;
      }
      const absolute = path.resolve(props.projectRoot, input);
      const spelling = path.resolve(absolute);
      if (
        !built.memberSpellings.has(spelling) &&
        !transformSourceSpellings.has(spelling)
      ) {
        continue;
      }
      const observation = built.inputObservations.get(spelling);
      const legacyProjection =
        observation === undefined
          ? undefined
          : legacyProjectionOfGraphInputObservation(observation);
      if (
        built.speculative.has(spelling) &&
        !built.inputProofs.has(spelling) &&
        legacyProjection?.failure === reason
      ) {
        continue;
      }
      if (built.inputObservations.has(spelling)) {
        built.inputObservations.delete(spelling);
        built.inputObservationConflicts.add(spelling);
      }
      if (built.inputProofs.has(spelling)) {
        built.inputProofs.delete(spelling);
        built.inputProofConflicts.add(spelling);
      }
      if (!built.inputProofFailures.has(spelling)) {
        built.inputProofFailures.set(spelling, reason);
      }
    }
  }
  state.graph = built;
  return built;
}

/** Normalize one untrusted predicate proof without filling missing predicates. */
function normalizeGraphInputObservation(
  value: unknown,
  platform: NodeJS.Platform = process.platform,
): ITtscCompilerTransformation.IInputObservation | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const entry = value as Record<string, unknown>;
  const observation: ITtscCompilerTransformation.IInputObservation = {};
  if (Object.prototype.hasOwnProperty.call(entry, "accessibleEntries")) {
    const accessible = entry.accessibleEntries;
    if (
      typeof accessible !== "object" ||
      accessible === null ||
      Array.isArray(accessible)
    ) {
      return undefined;
    }
    const lists = accessible as Record<string, unknown>;
    if (
      !Array.isArray(lists.directories) ||
      !lists.directories.every(
        (name): name is string => typeof name === "string",
      ) ||
      !Array.isArray(lists.files) ||
      !lists.files.every((name): name is string => typeof name === "string")
    ) {
      return undefined;
    }
    observation.accessibleEntries = {
      directories: [...lists.directories],
      files: [...lists.files],
    };
  }
  if (Object.prototype.hasOwnProperty.call(entry, "fileExists")) {
    if (typeof entry.fileExists !== "boolean") return undefined;
    observation.fileExists = entry.fileExists;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "directoryExists")) {
    if (typeof entry.directoryExists !== "boolean") return undefined;
    observation.directoryExists = entry.directoryExists;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "stat")) {
    if (
      entry.stat !== "missing" &&
      entry.stat !== "file" &&
      entry.stat !== "directory"
    ) {
      return undefined;
    }
    observation.stat = entry.stat;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "readFile")) {
    const read = entry.readFile;
    if (typeof read !== "object" || read === null || Array.isArray(read)) {
      return undefined;
    }
    const result = read as Record<string, unknown>;
    if (result.ok === false && result.hash === undefined) {
      observation.readFile = { ok: false };
    } else if (
      result.ok === true &&
      typeof result.hash === "string" &&
      /^[0-9a-f]{64}$/.test(result.hash)
    ) {
      observation.readFile = { hash: result.hash, ok: true };
    } else {
      return undefined;
    }
  }
  if (Object.prototype.hasOwnProperty.call(entry, "realpath")) {
    const realpath = entry.realpath;
    if (
      typeof realpath !== "object" ||
      realpath === null ||
      Array.isArray(realpath)
    ) {
      return undefined;
    }
    const result = realpath as Record<string, unknown>;
    if (result.ok === false && result.path === undefined) {
      observation.realpath = { ok: false };
    } else if (
      result.ok === true &&
      typeof result.path === "string" &&
      (platform === "win32" ? path.win32 : path.posix).isAbsolute(result.path)
    ) {
      observation.realpath = {
        ok: true,
        path: resolveFilesystemPath(result.path, platform),
      };
    } else {
      return undefined;
    }
  }
  return Object.keys(observation).length !== 0 &&
    graphInputObservationCompatible(observation)
    ? observation
    : undefined;
}

/** Join duplicate lexical keys only when every repeated predicate agrees. */
function mergeGraphInputObservations(
  left: ITtscCompilerTransformation.IInputObservation,
  right: ITtscCompilerTransformation.IInputObservation,
): ITtscCompilerTransformation.IInputObservation | undefined {
  for (const property of [
    "accessibleEntries",
    "directoryExists",
    "fileExists",
    "readFile",
    "realpath",
    "stat",
  ] as const) {
    if (
      left[property] !== undefined &&
      right[property] !== undefined &&
      JSON.stringify(left[property]) !== JSON.stringify(right[property])
    ) {
      return undefined;
    }
  }
  const merged = { ...left, ...right };
  return graphInputObservationCompatible(merged) ? merged : undefined;
}

/** Whether one predicate set can describe a single stable filesystem state. */
function graphInputObservationCompatible(
  observation: ITtscCompilerTransformation.IInputObservation,
): boolean {
  const { accessibleEntries, directoryExists, fileExists, readFile, stat } =
    observation;
  const hasAccessibleEntries =
    accessibleEntries !== undefined &&
    (accessibleEntries.directories.length !== 0 ||
      accessibleEntries.files.length !== 0);
  if (
    hasAccessibleEntries &&
    (fileExists === true ||
      directoryExists === false ||
      (stat !== undefined && stat !== "directory") ||
      readFile?.ok === true)
  ) {
    return false;
  }
  if (fileExists === true && directoryExists === true) return false;
  if (
    stat === "directory" &&
    (fileExists === true || directoryExists === false)
  ) {
    return false;
  }
  if (stat === "file" && (fileExists === false || directoryExists === true)) {
    return false;
  }
  if (stat === "missing" && (fileExists === true || directoryExists === true)) {
    return false;
  }
  if (
    readFile?.ok === true &&
    (fileExists === false ||
      directoryExists === true ||
      (stat !== undefined && stat !== "file"))
  ) {
    return false;
  }
  return true;
}

/**
 * Reconstruct a legacy hash/realpath pair only when the rich predicates prove
 * that projection without collapsing an unreadable file or failed file probe
 * into generic absence.
 */
function legacyProjectionOfGraphInputObservation(
  observation: ITtscCompilerTransformation.IInputObservation,
):
  | { failure?: undefined; hash: string | null; realpath: string | null }
  | { failure: string } {
  if (observation.readFile?.ok === true) {
    return observation.realpath?.ok === true
      ? {
          hash: observation.readFile.hash,
          realpath: observation.realpath.path,
        }
      : { failure: "realpath-unavailable" };
  }
  const directory =
    observation.stat === "directory" || observation.directoryExists === true;
  if (directory) {
    return observation.realpath?.ok === true
      ? {
          hash: hashText("ttsc:host-input:directory\0"),
          realpath: observation.realpath.path,
        }
      : { failure: "realpath-unavailable" };
  }
  const file = observation.stat === "file" || observation.fileExists === true;
  if (file) {
    return { failure: "content-unavailable" };
  }
  const missing =
    observation.stat === "missing" ||
    observation.fileExists === false ||
    observation.directoryExists === false ||
    observation.readFile?.ok === false;
  return missing
    ? { hash: null, realpath: null }
    : { failure: "unsupported-input-kind" };
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
 * Register the failed generation's project and external inputs so the host can
 * observe the fix.
 *
 * A successful delivery registers the derived watch inputs, which is how a
 * type-only file that no bundler graph contains still invalidates the modules
 * depending on it. A failed one used to register nothing: `selectWatchInputs`
 * returns an empty list for an `"exception"` envelope, and the throw happens
 * before `notifyWatchInputs` is reached at all. When the failing compile is the
 * first of a watching session, that leaves no channel through which the fix can
 * arrive: the user repairs a file the bundler does not track, nothing is
 * invalidated, and the error stays on screen (samchon/ttsc#1312).
 *
 * A failure envelope can retain exact external input spellings from its graph
 * and host metadata. A pre-transform typecheck failure may have no graph yet;
 * its structured diagnostics, or the host's standard diagnostic lines when it
 * could return only an exception, still name the external files that need a
 * repair. The cost is paid only on a failure, and only until the next compile
 * succeeds and narrows the set back to the derived inputs.
 */
function notifyFailedGenerationInputs(
  hooks: TtscTransformHooks | undefined,
  cached: TtscCachedProjectTransform,
): void {
  const addWatchFile = hooks?.addWatchFile;
  const addWatchFiles = hooks?.addWatchFiles;
  if (addWatchFile === undefined && addWatchFiles === undefined) {
    return;
  }
  const inputs: TtscWatchInput[] = [];
  const seen = new Set<string>();
  const append = (input: string): void => {
    const spelling = path.resolve(input);
    if (
      seen.has(spelling) ||
      isTransformScratchInput(spelling, cached.scratchDirectory)
    ) {
      return;
    }
    seen.add(spelling);
    // No evidence, deliberately. A failed generation is replayed for the rest
    // of its pass without re-proving its inputs, so the adapter must observe
    // the current availability itself.
    inputs.push({ file: spelling });
  };
  for (const key of Object.keys(cached.inputHashes)) {
    append(path.resolve(cached.projectRoot, key));
  }
  // The project walk deliberately excludes node_modules and cannot reach
  // sibling-project or out-of-root inputs. The generation already retained
  // their exact lexical spellings, so keep that ownership on the failure path
  // instead of deriving a narrower second answer.
  for (const input of cached.externalInputPaths ?? []) {
    append(input);
  }
  if (cached.result.type === "failure") {
    for (const diagnostic of cached.result.diagnostics) {
      if (typeof diagnostic.file === "string" && diagnostic.file.length !== 0) {
        append(path.resolve(cached.projectRoot, diagnostic.file));
      }
    }
  } else if (cached.result.type === "exception") {
    for (const diagnostic of selectExceptionDiagnosticFiles(
      cached.result.error,
    )) {
      append(path.resolve(cached.projectRoot, diagnostic));
    }
  }
  if (addWatchFiles !== undefined) {
    addWatchFiles(inputs);
    return;
  }
  for (const input of inputs) {
    addWatchFile!(input.file);
  }
}

/**
 * Extract file spellings only from the two standard TypeScript diagnostic
 * forms.
 */
function selectExceptionDiagnosticFiles(error: unknown): string[] {
  const files: string[] = [];
  for (const line of formatUnknownError(error).split(/\r?\n/)) {
    const colon =
      /^(.+):\d+:\d+\s+-\s+(?:error|warning|suggestion|message)\s+TS\d+:\s+.+$/i.exec(
        line,
      );
    const parenthesized =
      /^(.+?)\(\d+,\d+\):\s+(?:error|warning|suggestion|message)\s+TS\d+:\s+.+$/i.exec(
        line,
      );
    const file = colon?.[1] ?? parenthesized?.[1];
    if (file !== undefined && file.trim().length !== 0) {
      files.push(file.trim());
    }
  }
  return files;
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
 * watches the module it transforms), and so is every path in the disposed
 * transform scratch tree (see
 * {@link TtscCachedProjectTransform.scratchDirectory}).
 */
function notifyWatchInputs(
  hooks: TtscTransformHooks | undefined,
  cached: TtscCachedProjectTransform,
  file: string,
): void {
  const addWatchFile = hooks?.addWatchFile;
  const addWatchFiles = hooks?.addWatchFiles;
  if (addWatchFile === undefined && addWatchFiles === undefined) {
    return;
  }
  const state = envelopeDerivation(cached);
  const external = cached.externalInputHashes ?? {};
  const inputs = selectWatchInputs({
    file,
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  }).map((input): TtscWatchInput => {
    // Hand the adapter the identity this generation already resolved and the
    // exact state it already recorded. Both are memoized per generation, while
    // an adapter deriving them itself pays repeated filesystem reads and can
    // accidentally attach a later state to an earlier transform.
    const identity = derivationIdentity(state, input);
    const spelling = path.resolve(input);
    const observation = cached.externalInputObservations?.[spelling];
    const missing =
      observation?.fileExists === false ||
      state.graph?.inputProofs.get(spelling)?.hash === null ||
      external[identity] === MISSING_INPUT_STATE;
    const projectKey = toProjectKey(
      cached.projectRoot,
      input,
      state.identityContext,
    );
    const externalHash = Object.prototype.hasOwnProperty.call(
      external,
      identity,
    )
      ? external[identity]
      : undefined;
    const projectHash = Object.prototype.hasOwnProperty.call(
      cached.inputHashes,
      projectKey,
    )
      ? cached.inputHashes[projectKey]
      : undefined;
    const graphRealpaths = cached.externalInputRealpaths ?? {};
    const stateEvidence: TtscWatchInputState | undefined =
      observation !== undefined
        ? { codec: "predicates", observation }
        : externalHash !== undefined &&
            Object.prototype.hasOwnProperty.call(graphRealpaths, identity)
          ? {
              codec: "graph",
              hash: externalHash,
              realpath: graphRealpaths[identity] ?? null,
            }
          : externalHash !== undefined
            ? { codec: "host", hash: externalHash }
            : projectHash !== undefined
              ? { codec: "host", hash: projectHash }
              : undefined;
    return {
      file: input,
      evidence: {
        identity,
        missing,
        ...(stateEvidence === undefined ? {} : { state: stateEvidence }),
        unavailable:
          observation?.fileExists === false
            ? "not-file"
            : missing
              ? "missing"
              : undefined,
      },
    };
  });
  if (addWatchFiles !== undefined) {
    addWatchFiles(inputs);
    return;
  }
  for (const input of inputs) {
    addWatchFile!(input.file, input.evidence);
  }
}

/**
 * Derive the absolute, deduplicated watch-input list for a single file.
 *
 * By default the derivation unions plugin dependencies, the reachable graph,
 * globals, configs, importer resolver inputs, and universal resolver inputs.
 * The plugin-reported list can only widen the host-owned language-semantic
 * bound, never narrow it. Resolver inputs remain in that bound in both modes.
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
 * The derived list is a pure function of the envelope and the delivered file's
 * normalized lexical spelling. Graph traversal uses its filesystem identity,
 * but lexical inputs exclude only that exact spelling, so two aliases of one
 * source require distinct lists. Repeated deliveries of one spelling replay the
 * per-envelope memo ({@link envelopeDerivation}) instead of re-walking the
 * graph. Returns an empty list on exceptions.
 */
function selectWatchInputs(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
  temporaryTsconfig?: string;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const state = envelopeDerivation(props);
  const fileIdentity = derivationIdentity(state, props.file);
  const fileSpelling = path.resolve(props.file);
  const memoized = state.watchInputs.get(fileSpelling);
  if (memoized !== undefined) {
    return memoized;
  }
  const derived = deriveWatchInputs(state, props, fileIdentity);
  state.watchInputs.set(fileSpelling, derived);
  return derived;
}

/** Compute one file's watch-input list over the shared per-envelope state. */
function deriveWatchInputs(
  state: TtscEnvelopeDerivation,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
    scratchDirectory?: string;
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
      isTransformScratchInput(spelling, props.scratchDirectory) ||
      lexicalSeen.has(spelling)
    ) {
      return;
    }
    lexicalSeen.add(spelling);
    physicalSeen.add(derivationIdentity(state, input));
    output.push(input);
  };
  const appendPhysical = (input: string): void => {
    if (isTransformScratchInput(input, props.scratchDirectory)) return;
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
  // Resolver inputs, plugin dependencies, and universal host inputs
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
 * Return exact importer-owned and universal resolver inputs for `file`. They
 * remain host-owned even when a plugin declares `dependenciesComplete`: plugin
 * code cannot vouch for a compiler resolution or automatic type change that
 * occurs without any plugin input changing.
 *
 * Importer entries and their source identities come from the shared
 * per-envelope state, so one delivery scans only the recorded inputs instead of
 * re-resolving every source.
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
  if (props.result.type === "exception" || props.result.graph === undefined) {
    return [];
  }
  const reachable = new Set(
    selectReachableSources(graph, state, props.file).map((source) =>
      derivationIdentity(state, source),
    ),
  );
  const output: string[] = [...graph.resolutionInputs];
  if (props.result.graph.candidates === undefined) return output;
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
 * Extract the absolute, lexical-spelling-deduplicated dependency list for a
 * single file from the compiler result. Mirrors
 * {@link selectTransformedSource}'s key lookup: fast project-relative match
 * first, then a per-envelope identity index. Distinct lexical aliases must
 * survive so bundlers observe a later symlink or junction retarget. Returns an
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
  for (const entry of entries) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    const absolute = path.resolve(props.projectRoot, entry);
    if (seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
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
 * Returns `true` for every declaration-file spelling TypeScript-Go accepts.
 * Besides the standard `.d.ts`, `.d.mts`, and `.d.cts` forms, TypeScript-Go
 * treats an arbitrary-extension source such as `styles.d.css.ts` as a
 * declaration file too.
 */
export function isDeclarationFile(id: string): boolean {
  // Module ids can cross process/platform boundaries (for example, a Windows
  // id inspected by a POSIX host). TypeScript-Go normalizes both separators
  // before taking the basename, so a `.d.` directory component must not turn
  // an ordinary source into a declaration file.
  const normalized = id.replaceAll("\\", "/");
  const base = normalized.slice(normalized.lastIndexOf("/") + 1);
  return (
    base.endsWith(".d.ts") ||
    base.endsWith(".d.mts") ||
    base.endsWith(".d.cts") ||
    (base.endsWith(".ts") && base.includes(".d."))
  );
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
 * snapshot. A cache with a delivery epoch can use that comparison alone for a
 * stable generation's first delivery of each module in the current pass, once
 * the pass's own first delivery has proven the whole generation still matches
 * the filesystem. An incomplete generation may not take this shortcut:
 * otherwise a sibling output captured during a filesystem race could still be
 * served once. Later graph-bearing requests validate the file's derived input
 * set and project membership; graph-free envelopes conservatively re-hash the
 * complete project and out-of-walk snapshots. Any mismatch forces a complete
 * re-transform.
 */
function matchesCachedSource(
  cached: TtscCachedProjectTransform,
  file: string,
  source: string,
  epoch: number | undefined,
): boolean {
  const identities = envelopeDerivation(cached).identityContext;
  const currentKey = toProjectKey(cached.projectRoot, file, identities);
  const identity = pathIdentityKey(file, identities);
  const expected =
    cached.sourceHashes?.[identity] ??
    cached.inputHashes[currentKey] ??
    cached.externalInputHashes?.[identity];
  if (expected !== hashText(source)) {
    return false;
  }
  if (epoch !== undefined && cached.projectSnapshotComplete === true) {
    if (cached.deliveryEpoch !== epoch) {
      // The pass's first delivery. The generation was settled against an
      // earlier pass, so prove the whole of it once — every input the envelope
      // declares, the directory membership, the universal host inputs, and the
      // out-of-walk snapshot — before any of this pass's deliveries may be
      // settled against it. That proof is what a per-pass recompile used to buy
      // (samchon/ttsc#1300), at a walk instead of a compile.
      refreshFilesystemClockReference(
        TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.get(cached),
        resultFilesystem(cached.result),
      );
      if (!matchesCompleteInputSnapshot(cached, currentKey, source)) {
        return false;
      }
      cached.deliveryEpoch = epoch;
      cached.servedFiles?.clear();
      return true;
    }
    if (!cached.servedFiles?.has(identity)) {
      return true;
    }
  }
  refreshFilesystemClockReference(
    TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.get(cached),
    resultFilesystem(cached.result),
  );
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
 * Returns `undefined` when this narrow proof is unavailable — live
 * notifications can no longer prove membership, or the generation carries no
 * universal-input manifest. That is the absence of a proof, not evidence of a
 * change, so the caller falls back to complete-snapshot validation instead of
 * discarding the generation. A reported membership event, a changed universal
 * input, or a changed derived input is evidence, and returns `false`.
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
  const hostValidation = cached.hostInputValidation;
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
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  });
  for (const input of inputs) {
    // Skip by spelling, not identity: the manifest proved this exact path, and
    // an alias of the same physical file is a different input whose own
    // retarget nothing else would see.
    if (hostValidation.covered.has(path.resolve(input))) {
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
 * while the recorded metadata signature still holds and its freshly minted
 * clock reference remains safe.
 *
 * Sibling deliveries of one generation share most of their derived inputs, and
 * `graph.globals` is shared by every one of them, so re-reading and re-hashing
 * the whole derived set per delivery multiplies one generation's proven bytes
 * by the module count. The derived set is proven the same way the universal
 * descriptor inputs are ({@link matchesUniversalHostInputs}), under the same
 * rules: a currently separable unchanged signature stands in for the content
 * comparison, and any signature or clock-ordering change falls back to the full
 * comparison. A signature is recorded only around a read nothing raced, only
 * for a recorded state that came from reading the input rather than from
 * failing to, and only while the observed filesystem's own clock has provably
 * left the stamp's tick ({@link stampSeparable}), so a same-length rewrite
 * inside that tick cannot hide behind an unchanged signature.
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
  const observation = cached.externalInputObservations?.[path.resolve(input)];
  if (observation !== undefined) {
    if (
      observation.fileExists === false &&
      Object.keys(observation).length === 1 &&
      notifiesAbsence(cached, input)
    ) {
      return true;
    }
    return matchesRecordedInput(cached, input);
  }
  const slot = inputSignatureSlot(cached, state, input);
  if (slot === undefined) {
    return matchesRecordedInput(cached, input);
  }
  if (slot.recorded === MISSING_INPUT_STATE && notifiesAbsence(cached, input)) {
    // The generation's watcher holds this exact name, and the caller already
    // established that neither tracker failed and neither reported a change.
    // The path is therefore still absent, proven by the same channel that
    // proves project membership, and probing it again would only repeat what
    // the notification already answered.
    return true;
  }
  const filesystem = resultFilesystem(cached.result);
  const before = inputMetadataEvidence(input, filesystem);
  if (
    before !== undefined &&
    before.separable &&
    slot.signatures[slot.key] === before.signature
  ) {
    return true;
  }
  if (!matchesRecordedInput(cached, input)) {
    return false;
  }
  // A recorded `missing` state is the one comparison that succeeds without
  // reading anything: an unreadable path still reports `missing`, so its
  // metadata can hold still while the bytes behind it appear. Only content a
  // read produced may be stood for.
  const after =
    slot.recorded === MISSING_INPUT_STATE
      ? undefined
      : inputMetadataSignature(input, filesystem);
  if (after !== undefined && before?.signature === after && before.separable) {
    slot.signatures[slot.key] = after;
  } else {
    delete slot.signatures[slot.key];
  }
  return true;
}

/**
 * Report whether the generation's live watcher would announce a creation at
 * this absent input's exact spelling.
 *
 * Losing the watcher is not evidence of anything, so a failed tracker sends the
 * input back to being probed by hand, exactly as a failed tracker already sends
 * the whole generation back to complete-snapshot validation.
 */
function notifiesAbsence(
  cached: TtscCachedProjectTransform,
  input: string,
): boolean {
  const tracker = cached.candidateMutationTracker;
  return (
    tracker !== undefined &&
    !tracker.failed &&
    tracker.covered?.has(path.resolve(input)) === true
  );
}

/**
 * Locate the signature manifest that owns one recorded input, mirroring
 * {@link matchesRecordedInput}'s own preference for the out-of-walk spelling's
 * snapshot over the walked project's.
 *
 * The manifest is returned whether or not it currently holds a signature for
 * the input, so a content comparison that succeeds can record one. Without
 * that, an input whose capture-time metadata was too recent to prove anything
 * would keep its content read for the whole life of the generation, since
 * nothing else ever revisits it. Returns `undefined` only for an input the
 * generation recorded no hash for, which no signature could stand for.
 */
function inputSignatureSlot(
  cached: TtscCachedProjectTransform,
  state: TtscEnvelopeDerivation,
  input: string,
):
  | { key: string; recorded: string; signatures: Record<string, string> }
  | undefined {
  const identity = derivationIdentity(state, input);
  if (cached.externalInputObservations?.[path.resolve(input)] !== undefined) {
    return undefined;
  }
  const external = cached.externalInputHashes ?? {};
  if (Object.prototype.hasOwnProperty.call(external, identity)) {
    // The recorded hash is identity-keyed because aliases of one physical file
    // share its content; the signature is spelling-keyed because they do not
    // share its metadata.
    return {
      key: path.resolve(input),
      recorded: external[identity]!,
      signatures: (cached.externalInputSignatures ??= {}),
    };
  }
  const projectKey = toProjectKey(
    cached.projectRoot,
    input,
    state.identityContext,
  );
  return Object.prototype.hasOwnProperty.call(cached.inputHashes, projectKey)
    ? {
        key: projectKey,
        recorded: cached.inputHashes[projectKey]!,
        signatures: (cached.inputSignatures ??= {}),
      }
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
  return (
    matchesUniversalHostInputEntries(cached, validation) &&
    matchesUniversalHostInputProbes(cached, validation)
  );
}

/**
 * Validate the universal inputs that exist, by metadata first and content only
 * when that moved.
 *
 * Every rejection here is evidence of a change — a vanished path, a moved
 * physical target, a strict blocker's metadata, differing content — so this
 * half is safe for a validation path that must never discard a generation for
 * want of a proof.
 */
function matchesUniversalHostInputEntries(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
): boolean {
  const filesystem = resultFilesystem(cached.result);
  for (const entry of validation.entries.values()) {
    const evidence = inputMetadataEvidence(entry.path, filesystem);
    if (
      entry.signature !== undefined &&
      evidence?.signature === entry.signature &&
      (entry.strict === true || evidence.separable)
    )
      continue;
    if (entry.strict === true) return false;
    if (hostInputRealpath(entry.path, filesystem) !== entry.realpath)
      return false;
    if (!matchesRecordedInput(cached, entry.path)) {
      return false;
    }
    if (evidence === undefined) return false;
    // Re-earn the proof under the rules the capture applies: an entry whose
    // recorded state came from reading nothing keeps its content comparison, a
    // write racing the read that just proved it records nothing, and a stamp
    // the filesystem's clock has not provably left records nothing either.
    const after = inputMetadataSignature(entry.path, filesystem);
    entry.signature =
      entry.readable && evidence.separable && after === evidence.signature
        ? evidence.signature
        : undefined;
  }
  return true;
}

/**
 * Prove the universal inputs that were absent are still absent, through one
 * exact listing of the nearest directory that can settle it.
 *
 * Unlike the entries half, this one rejects on an inability to prove: a
 * directory that exists but cannot be listed certifies nothing about the
 * candidates inside it. That is the right answer for the narrow path, which has
 * no stronger proof to fall back to, but not for the whole-snapshot path, where
 * the recorded `missing` markers are re-compared directly and losing a proof
 * must not cost the cache.
 */
function matchesUniversalHostInputProbes(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
): boolean {
  const filesystem = resultFilesystem(cached.result);
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
): {
  failures: TtscGenerationProofFailures;
  validation?: TtscHostInputValidation;
} {
  const filesystem = resultFilesystem(cached.result);
  const state = envelopeDerivation(cached);
  const failures = createGenerationProofFailures();
  const validation: TtscHostInputValidation = {
    entries: new Map(),
    covered: new Set(),
    missing: new Map(),
  };
  for (const input of selectPersistentHostInputs({
    filesystem,
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
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
    let readable = false;
    if (expected === undefined) {
      const current = path.resolve(currentFile);
      if (path.resolve(input) !== current) {
        recordGenerationProofFailure(failures, {
          domain: "host",
          kind: "content-proof-missing",
          path: input,
        });
        return { failures };
      }
      // The current module may be supplied from an unsaved editor buffer. Its
      // generation snapshot is overlaid below from `currentSource`, so a disk
      // fingerprint would be both unavailable and the wrong authority. The
      // recorded state is the bundler's, so a signature of the disk cannot
      // stand for it however readable that disk is.
    } else {
      const current = hostInputStateHash(input, filesystem);
      if (expected !== current) {
        recordGenerationProofFailure(failures, {
          domain: "host",
          kind: "content-changed",
          path: input,
        });
        return { failures };
      }
      // A path both sides agree they could not read carries no bytes for a
      // signature to stand for. It still belongs in the manifest, so the
      // content comparison keeps running for it on every delivery.
      readable = current !== null;
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
        recordGenerationProofFailure(failures, {
          domain: "host",
          kind: Object.prototype.hasOwnProperty.call(
            generationRealpaths,
            absoluteInput,
          )
            ? "realpath-changed"
            : "realpath-proof-missing",
          path: input,
        });
        return { failures };
      }
    }
    validation.covered.add(path.resolve(input));
    const before = inputMetadataEvidence(input, filesystem);
    if (!matchesRecordedInput(cached, input)) {
      recordGenerationProofFailure(failures, {
        domain: "host",
        kind: "snapshot-mismatch",
        path: input,
      });
      return { failures };
    }
    const after = inputMetadataSignature(input, filesystem);
    if (before?.signature !== after) {
      recordGenerationProofFailure(failures, {
        domain: "host",
        kind: "changed-during-validation",
        path: input,
      });
      return { failures };
    }
    if (before !== undefined) {
      // Do not key this manifest by physical identity. A symlink/junction
      // spelling and its selected target deliberately share that identity,
      // but both lexical paths must survive so retargeting the alias is visible.
      validation.entries.set(path.resolve(input), {
        path: input,
        readable,
        realpath: hostInputRealpath(input, filesystem),
        // The signature stands in for content only when the read produced the
        // recorded bytes and the filesystem's clock has provably left the
        // stamp's tick; otherwise the content comparison keeps running until
        // the re-earn path can prove both.
        signature: readable && before.separable ? before.signature : undefined,
      });
      continue;
    }
    const probe = missingPathProbe(input, filesystem);
    if (probe.blocker !== undefined) {
      const signature = inputMetadataSignature(probe.blocker, filesystem);
      if (signature === undefined) {
        recordGenerationProofFailure(failures, {
          domain: "host",
          kind: "blocker-metadata-unavailable",
          path: probe.blocker,
        });
        return { failures };
      }
      // A blocker proves a kind and an identity, not content: it is the
      // non-directory ancestor that makes everything below it unreachable, and
      // it cannot stop being that without its metadata moving. So it keeps a
      // usable signature whether or not anything read it, and exempt from the
      // clock-separability rule content signatures need — a same-tick rewrite
      // of its bytes leaves it exactly as blocking as before.
      validation.covered.add(path.resolve(probe.blocker));
      validation.entries.set(path.resolve(probe.blocker), {
        path: probe.blocker,
        readable: true,
        realpath: hostInputRealpath(probe.blocker, filesystem),
        signature,
        strict: true,
      });
      continue;
    }
    // The probe below proves this exact spelling absent, so the per-module loop
    // need not re-derive it either.
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
  cached.hostInputValidation = validation;
  return { failures, validation };
}

/**
 * The recorded state of an input the generation read nothing from: absent, or
 * present but unreadable. It is deliberately not a hash, so no signature may
 * stand in for it: the metadata of an unreadable path holds still while the
 * bytes behind it appear.
 *
 * A directory is not this state. It records the hash of a marker instead, which
 * a signature may stand for, because the mode both halves of the signature
 * carry cannot change without the path ceasing to be that directory.
 */
const MISSING_INPUT_STATE = "missing";

/**
 * The current stamp an adapter-owned probe has minted, keyed by the operations
 * object that observes it and, inside, by reporting device.
 *
 * A filesystem stamps a write once per clock tick, so two same-length writes
 * inside one tick are indistinguishable by metadata alone. A signature may
 * therefore stand for content only while a later write is guaranteed to move
 * it, and that guarantee needs a reference instant the observed filesystem
 * itself produced: once some stamp on the same device is strictly newer than an
 * input's modification stamp, that input's tick is provably over, so any later
 * write must mint a newer stamp and move the signature. This adapts git's
 * racily-clean index rule: both sides of the comparison come from the same
 * reporting device, and the newer side is a write the adapter itself made.
 *
 * A timestamp merely observed on another input cannot advance the reference.
 * Tools may assign modification times, and a filesystem clock can move
 * backwards independently of the process clock. Neither a passive historical
 * maximum nor `Date.now()` proves what stamp a write would mint now. The probe
 * is therefore rewritten immediately before every validation that may reuse a
 * content signature, and its previous reference is cleared before the write. A
 * failed refresh or a different reporting device declines the optimization and
 * retains the content comparison (samchon/ttsc#1344).
 *
 * The probe lives in an adapter-owned temporary directory outside the project.
 * That directory may be on another volume, such as `C:` when a project lives on
 * `D:`. Such a split-volume generation safely keeps reading content because no
 * same-device reference exists; it never substitutes a process-clock guess or
 * writes a probe into the user's project.
 */
const FILESYSTEM_CLOCK_REFERENCES = new WeakMap<
  TtscTransformFilesystemOperations,
  Map<bigint, bigint>
>();

/** Return one observed filesystem's current per-device references. */
function filesystemClockReferences(
  filesystem: TtscTransformFilesystemOperations,
): Map<bigint, bigint> {
  let references = FILESYSTEM_CLOCK_REFERENCES.get(filesystem);
  if (references === undefined) {
    references = new Map();
    FILESYSTEM_CLOCK_REFERENCES.set(filesystem, references);
  }
  return references;
}

/**
 * Report whether a later write to the observed path is guaranteed to move its
 * modification stamp: the device's current probe holds a stamp strictly newer,
 * so the tick that minted the stamp is provably over. The probe was written
 * before the caller's content read began, which is the ordering the guarantee
 * needs — a stamp minted before the read proves every post-read write lands in
 * a newer tick.
 */
function stampSeparable(
  filesystem: TtscTransformFilesystemOperations,
  stats: fs.BigIntStats,
): boolean {
  const reference = filesystemClockReferences(filesystem).get(stats.dev);
  return reference !== undefined && stats.mtimeNs < reference;
}

/**
 * Replace every prior clock proof with one reference minted by a fresh write.
 *
 * The reference directory is storage the adapter already owns, deliberately
 * outside the project root, so stamping a probe file there produces a
 * freshly-minted "now" without touching the user's project — the analogue of
 * git writing its index. The probe is observed through the cache-owned
 * operations and keyed by the device those operations report, so it only ever
 * separates stamps on the filesystem that actually minted it. When its volume
 * differs from the inputs' volume, or the observed filesystem cannot see the
 * probe at all, nothing is proven and content comparison continues.
 *
 * Forcing the reference onto the inputs' volume would require writing into the
 * user's project or an otherwise unowned neighboring directory. That is not a
 * valid price for this optimization, so the cross-volume case degrades to more
 * reads instead.
 */
function refreshFilesystemClockReference(
  referenceDirectory: string | undefined,
  filesystem: TtscTransformFilesystemOperations,
): void {
  const references = filesystemClockReferences(filesystem);
  references.clear();
  if (referenceDirectory === undefined) return;
  try {
    const probe = path.join(referenceDirectory, "clock-reference");
    fs.writeFileSync(probe, `${process.hrtime.bigint()}\n`);
    const stats = filesystem.lstat(probe);
    if (stats.isFile()) {
      references.set(stats.dev, stats.mtimeNs);
    }
  } catch {
    // A failed refresh leaves no reference, so content comparison continues.
    references.clear();
  }
}

/** Remove only the known probe and its now-empty owned directory. */
function disposeFilesystemClockReference(referenceDirectory: string): void {
  try {
    fs.rmSync(path.join(referenceDirectory, "clock-reference"), {
      force: true,
    });
  } catch {
    // The probe may already have disappeared; the directory removal below is
    // still safe because it is deliberately non-recursive.
  }
  try {
    fs.rmdirSync(referenceDirectory);
  } catch {
    // Eviction schedules cleanup without awaiting its Promise. A foreign entry
    // or a concurrent removal leaves, at worst, an empty temporary directory.
  }
}

/**
 * One metadata observation: the signature plus whether the observed filesystem
 * has provably moved past every write-mintable stamp inside it.
 */
interface TtscInputMetadataEvidence {
  /** The joined metadata signature of the lexical path and its link target. */
  signature: string;
  /**
   * Whether a later write is guaranteed to move this signature. Only a
   * signature captured with this evidence may be recorded to stand in for a
   * content comparison; without it, a same-length rewrite inside the stamp's
   * own clock tick would leave the signature unchanged.
   */
  separable: boolean;
}

/** Metadata identity whose stability lets a generation reuse a content hash. */
function inputMetadataSignature(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | undefined {
  return inputMetadataEvidence(file, filesystem)?.signature;
}

/** Observe one input's metadata signature and its clock separability. */
function inputMetadataEvidence(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): TtscInputMetadataEvidence | undefined {
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
        // cannot observe a target created in another directory. It carries no
        // readable bytes, so it never needs to be separable.
        return {
          signature: [
            link.dev,
            link.ino,
            link.mode,
            link.size,
            link.mtimeNs,
            link.ctimeNs,
            "missing-target",
          ].join(":"),
          separable: false,
        };
      }
    }
    return {
      signature: [
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
      ].join(":"),
      // Both halves must be separable: a write remints the target's stamp, a
      // link retarget the link's own, and either one hiding inside its recorded
      // tick would evade the skipped content and realpath comparisons.
      separable:
        stampSeparable(filesystem, link) && stampSeparable(filesystem, target),
    };
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
  const kind = compilerStatKind(file, filesystem);
  const readHash = graphInputReadHash(file, filesystem, kind);
  if (readHash !== null) return readHash;
  return kind === "directory" ? hashText("ttsc:host-input:directory\0") : null;
}

/** Hash only a successful compiler-style ReadFile result, without kind fallback. */
function graphInputReadHash(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  observedKind?: "directory" | "file" | "missing",
): string | null {
  const kind = observedKind ?? compilerStatKind(file, filesystem);
  try {
    if (kind === "directory") return null;
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
    return null;
  }
}

/** Current result of TypeScript-Go's Stat predicate. */
function compilerStatKind(
  file: string,
  filesystem: TtscTransformFilesystemOperations,
): "directory" | "file" | "missing" {
  try {
    return filesystem.stat(file).isDirectory() ? "directory" : "file";
  } catch {
    return "missing";
  }
}

/** Return the exact recorded predicates that no longer hold for one spelling. */
function graphInputObservationFailures(
  file: string,
  observation: ITtscCompilerTransformation.IInputObservation,
  filesystem: TtscTransformFilesystemOperations,
  identities: FilesystemPathIdentityContext,
): string[] {
  const failures: string[] = [];
  if (observation.accessibleEntries !== undefined) {
    const current = compilerAccessibleEntries(file, filesystem);
    if (
      JSON.stringify(current) !== JSON.stringify(observation.accessibleEntries)
    ) {
      failures.push("accessible-entries-changed");
    }
  }
  const kind =
    observation.fileExists !== undefined ||
    observation.directoryExists !== undefined ||
    observation.stat !== undefined ||
    observation.readFile !== undefined
      ? compilerStatKind(file, filesystem)
      : undefined;
  if (
    observation.fileExists !== undefined &&
    (kind === "file") !== observation.fileExists
  ) {
    failures.push("file-exists-changed");
  }
  if (
    observation.directoryExists !== undefined &&
    (kind === "directory") !== observation.directoryExists
  ) {
    failures.push("directory-exists-changed");
  }
  if (observation.stat !== undefined && kind !== observation.stat) {
    failures.push("stat-changed");
  }
  if (observation.readFile !== undefined) {
    const currentHash = graphInputReadHash(file, filesystem, kind);
    if (
      (observation.readFile.ok && currentHash !== observation.readFile.hash) ||
      (!observation.readFile.ok && currentHash !== null)
    ) {
      failures.push("read-file-changed");
    }
  }
  if (observation.realpath !== undefined) {
    const currentRealpath = compilerInputRealpathObservation(file, filesystem);
    if (
      observation.realpath.ok !== currentRealpath.ok ||
      (observation.realpath.ok &&
        currentRealpath.ok &&
        !sameHostInputRealpath(
          observation.realpath.path,
          currentRealpath.path,
          identities,
        ))
    ) {
      failures.push("realpath-changed");
    }
  }
  return failures;
}

/** Replay TypeScript-Go's accessible-entry classification and sorted order. */
function compilerAccessibleEntries(
  directory: string,
  filesystem: TtscTransformFilesystemOperations,
): NonNullable<
  ITtscCompilerTransformation.IInputObservation["accessibleEntries"]
> {
  const directories: string[] = [];
  const files: string[] = [];
  const pathApi = filesystem.platform === "win32" ? path.win32 : path.posix;
  let entries: fs.Dirent[];
  try {
    entries = filesystem.readdir(directory);
  } catch {
    return { directories, files };
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      directories.push(entry.name);
      continue;
    }
    if (entry.isFile()) {
      files.push(entry.name);
      continue;
    }
    if (!entry.isSymbolicLink()) continue;
    try {
      const target = filesystem.stat(pathApi.join(directory, entry.name));
      if (target.isDirectory()) directories.push(entry.name);
      else if (target.isFile()) files.push(entry.name);
    } catch {
      // TypeScript-Go omits inaccessible and broken linked entries.
    }
  }
  directories.sort();
  files.sort();
  return { directories, files };
}

/** Validate one predicate-preserving graph proof against a filesystem view. */
export function validateGraphInputObservation(
  file: string,
  observation: ITtscCompilerTransformation.IInputObservation,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string[] {
  const normalized = normalizeGraphInputObservation(
    observation,
    filesystem.platform,
  );
  if (normalized === undefined) return ["proof-conflict"];
  return graphInputObservationFailures(
    file,
    normalized,
    filesystem,
    createHostPathIdentityContext(filesystem),
  );
}

/** Whether every compiler-time predicate still returns its recorded value. */
function matchesGraphInputObservation(
  file: string,
  observation: ITtscCompilerTransformation.IInputObservation,
  filesystem: TtscTransformFilesystemOperations,
  identities: FilesystemPathIdentityContext,
): boolean {
  return (
    graphInputObservationFailures(file, observation, filesystem, identities)
      .length === 0
  );
}

/** Replay TypeScript-Go's Realpath result, including its lexical fallback. */
function compilerInputRealpathObservation(
  file: string,
  filesystem: TtscTransformFilesystemOperations,
): NonNullable<ITtscCompilerTransformation.IInputObservation["realpath"]> {
  try {
    const realpath = filesystem.realpath(file);
    return realpath.length === 0
      ? { ok: false }
      : {
          ok: true,
          path: resolveFilesystemPath(realpath, filesystem.platform),
        };
  } catch {
    // TypeScript-Go's OS and io filesystems return the cleaned input spelling
    // when native realpath resolution fails; they do not expose the failure.
    return {
      ok: true,
      path: resolveFilesystemPath(file, filesystem.platform),
    };
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
  if (
    cached.projectSnapshotComplete !== true ||
    cached.projectDirectories === undefined
  ) {
    return false;
  }
  // Universal descriptor/config inputs carry a physical-identity proof that no
  // content comparison can replace: retargeting a symlinked input to a
  // byte-identical file selects a different file, and its own transitive
  // requires with it. Only the graph half of the out-of-walk snapshot records
  // realpaths, so without this the fallback would quietly hold a lower standard
  // than the narrow path it stands in for.
  const state = envelopeDerivation(cached);
  const hostValidation = cached.hostInputValidation;
  if (
    hostValidation === undefined ||
    !matchesUniversalHostInputEntries(cached, hostValidation)
  ) {
    return false;
  }
  const declaredInputs = declaredProjectInputKeys(state, cached);
  const current = collectProjectInputSnapshot(
    cached.projectRoot,
    state.identityContext,
    resultFilesystem(cached.result),
    cached.inputSignatures === undefined
      ? undefined
      : { hashes: cached.inputHashes, signatures: cached.inputSignatures },
    {
      // Judge membership by the rule the compile ran under, and read only the
      // inputs this comparison actually consults.
      declaredKeys: declaredInputs,
      policy: cached.membershipPolicy,
    },
  );
  if (!walkSnapshotComplete(current, declaredInputs)) {
    return false;
  }
  if (
    !sameProjectDirectories(
      cached.projectDirectories,
      current.projectDirectories,
    )
  ) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(cached.inputHashes, currentKey)) {
    current.hashes[currentKey] = hashText(source);
  }
  if (!sameHashes(cached.inputHashes, current.hashes, declaredInputs)) {
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
  const externalCurrent = matchesCachedExternalInputs(cached);
  if (!externalCurrent.matches || !matchesExternalInputRealpaths(cached)) {
    return false;
  }
  adoptProvenSignatures(cached, {
    currentKey,
    external: externalCurrent.signatures,
    project: current.provenSignatures,
  });
  return true;
}

/**
 * Adopt the signatures captured while this walk proved every recorded input
 * still carries its recorded content.
 *
 * Without this, a metadata-only change — a touch, or a rewrite of identical
 * bytes — costs a re-read on every later delivery for the rest of the
 * generation's life, because the recorded signature can never match again. The
 * narrow path self-heals through {@link matchesProvenInput}; this is the same
 * refresh for the path that proves the whole snapshot at once.
 *
 * The delivered file is the single exclusion: its recorded hash is the source
 * the bundler supplied, so the disk bytes this walk read for it were compared
 * against nothing.
 */
function adoptProvenSignatures(
  cached: TtscCachedProjectTransform,
  proven: {
    currentKey: string;
    external: Record<string, string>;
    project: Record<string, string>;
  },
): void {
  const projectSignatures = (cached.inputSignatures ??= {});
  for (const [key, signature] of Object.entries(proven.project)) {
    if (key === proven.currentKey) continue;
    projectSignatures[key] = signature;
  }
  const externalSignatures = (cached.externalInputSignatures ??= {});
  for (const [spelling, signature] of Object.entries(proven.external)) {
    externalSignatures[spelling] = signature;
  }
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
    if (cached.externalInputObservations?.[path.resolve(input)] !== undefined) {
      continue;
    }
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
 * earlier graph. Graph members and out-of-walk transformed sources must carry
 * compiler-time proof and still match it now; plugin-declared dependency-only
 * paths retain the historical post-compile snapshot because their own protocol
 * does not claim generation fingerprints.
 */
function captureExternalInputSnapshot(
  cached: TtscCachedProjectTransform,
  paths: readonly string[],
): {
  complete: boolean;
  failures: TtscGenerationProofFailures;
  hashes: Record<string, string>;
  observations: Record<string, ITtscCompilerTransformation.IInputObservation>;
  realpaths: Record<string, string | null>;
  signatures: Record<string, string>;
} {
  const state = envelopeDerivation(cached);
  const filesystem = resultFilesystem(cached.result);
  const graph = envelopeGraphIndexes(state, cached);
  // A non-declaration transform output is a compiler-realized source even when
  // a malformed or legacy graph omitted its node. Its output was computed from
  // compiler-time bytes, so a post-compile host read cannot prove coherence.
  const transformSourceSpellings = new Set<string>();
  if (cached.result.type === "success") {
    for (const output of Object.keys(cached.result.typescript)) {
      if (!isDeclarationFile(output)) {
        transformSourceSpellings.add(path.resolve(cached.projectRoot, output));
      }
    }
  }
  const hashes: Record<string, string> = {};
  const observations: Record<
    string,
    ITtscCompilerTransformation.IInputObservation
  > = {};
  const realpaths: Record<string, string | null> = {};
  const signatures: Record<string, string> = {};
  const failures = createGenerationProofFailures();
  let complete = true;
  // Sandwich every read between two metadata signatures. Only a signature that
  // survived its own read, and whose stamp's tick the filesystem's clock has
  // provably left ({@link stampSeparable}), may stand in for the content
  // comparison; a write racing the capture, or a stamp a same-tick rewrite
  // could still reproduce, leaves the input without one, so revalidation keeps
  // re-reading it.
  const record = (
    input: string,
    before: TtscInputMetadataEvidence | undefined,
    after: string | undefined,
  ): void => {
    if (after !== undefined && before?.signature === after && before.separable)
      signatures[path.resolve(input)] = after;
  };
  for (const input of paths) {
    const identity = derivationIdentity(state, input);
    const spelling = path.resolve(input);
    const predicateObservation = graph.inputObservations.get(spelling);
    const predicateConflict = graph.inputObservationConflicts.has(spelling);
    if (
      graph.speculative.has(spelling) &&
      (predicateObservation !== undefined || predicateConflict)
    ) {
      if (predicateConflict || predicateObservation === undefined) {
        complete = false;
        recordGenerationProofFailure(failures, {
          domain: "external",
          kind: "graph-proof-conflict",
          detail: graph.inputProofFailures.get(spelling),
          path: input,
        });
        continue;
      }
      const mismatches = graphInputObservationFailures(
        input,
        predicateObservation,
        filesystem,
        state.identityContext,
      );
      if (mismatches.length !== 0) complete = false;
      for (const kind of mismatches) {
        recordGenerationProofFailure(failures, {
          domain: "external",
          kind: `graph-${kind}`,
          path: input,
        });
      }
      observations[spelling] = predicateObservation;
      continue;
    }
    // A member the envelope reported only as a resolver input falls
    // through to the recorded-state branch below, the same evidence a
    // plugin-declared dependency path carries. Its absence still invalidates
    // the generation when it appears, because `missing` is recorded state.
    const realizedTransformSource = transformSourceSpellings.has(spelling);
    const speculativeOnly =
      !realizedTransformSource &&
      graph.speculative.has(spelling) &&
      !graph.inputProofs.has(spelling) &&
      !graph.inputProofConflicts.has(spelling) &&
      !graph.inputProofFailures.has(spelling);
    if (
      (realizedTransformSource || graph.memberSpellings.has(spelling)) &&
      !speculativeOnly
    ) {
      const proof = graph.inputProofs.get(spelling);
      if (proof === undefined || graph.inputProofConflicts.has(spelling)) {
        complete = false;
        recordGenerationProofFailure(failures, {
          domain: "external",
          kind: graph.inputProofConflicts.has(spelling)
            ? "graph-proof-conflict"
            : "graph-proof-missing",
          detail: graph.inputProofFailures.get(spelling),
          path: input,
        });
        continue;
      }
      const before = inputMetadataEvidence(input, filesystem);
      const currentHash = graphInputStateHash(input, filesystem);
      const currentRealpath = hostInputRealpath(input, filesystem);
      const after = inputMetadataSignature(input, filesystem);
      const realpathMatches = sameHostInputRealpath(
        proof.realpath,
        currentRealpath,
        state.identityContext,
      );
      if (currentHash !== proof.hash || !realpathMatches) {
        complete = false;
        if (currentHash !== proof.hash) {
          recordGenerationProofFailure(failures, {
            domain: "external",
            kind: "graph-content-changed",
            path: input,
          });
        }
        if (!realpathMatches) {
          recordGenerationProofFailure(failures, {
            domain: "external",
            kind: "graph-realpath-changed",
            path: input,
          });
        }
      } else if (currentHash !== null) {
        // The recorded hash is the compiler's own proof, so a signature may
        // only stand for it once the current bytes were shown to match it.
        // A path with no readable content has no bytes to stand for: it can
        // hold stable metadata while becoming readable, so it keeps the read.
        record(input, before, after);
      }
      hashes[identity] = proof.hash ?? MISSING_INPUT_STATE;
      realpaths[identity] = proof.realpath;
      continue;
    }
    const before = inputMetadataEvidence(input, filesystem);
    const hash = hostInputStateHash(input, filesystem);
    const after = inputMetadataSignature(input, filesystem);
    hashes[identity] = hash ?? MISSING_INPUT_STATE;
    if (hash !== null) record(input, before, after);
  }
  return {
    complete,
    failures,
    hashes,
    observations,
    realpaths,
    signatures,
  };
}

/** Explain every graph member that no longer matches the compiler's state. */
function compilerGraphInputProofFailures(
  cached: TtscCachedProjectTransform,
): TtscGenerationProofFailures {
  const failures = createGenerationProofFailures();
  if (
    cached.result.type === "exception" ||
    cached.result.graph === undefined ||
    (cached.result.graph.inputHashes === undefined &&
      cached.result.graph.inputObservations === undefined &&
      cached.result.graph.inputRealpaths === undefined &&
      cached.result.graph.inputProofFailures === undefined)
  ) {
    // Legacy sidecars remain compatible for ordinary in-project graphs. Their
    // out-of-walk members are still rejected by captureExternalInputSnapshot,
    // where a post-compile snapshot cannot prove the compiler's generation.
    return failures;
  }
  const state = envelopeDerivation(cached);
  const filesystem = resultFilesystem(cached.result);
  const graph = envelopeGraphIndexes(state, cached);
  const predicateSpellings = new Set<string>();
  const predicateConflictSpellings = new Set<string>();
  for (const [spelling, observation] of graph.inputObservations) {
    predicateSpellings.add(spelling);
    for (const kind of graphInputObservationFailures(
      spelling,
      observation,
      filesystem,
      state.identityContext,
    )) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind,
        path: spelling,
      });
    }
  }
  for (const spelling of graph.inputObservationConflicts) {
    predicateSpellings.add(spelling);
    predicateConflictSpellings.add(spelling);
    recordGenerationProofFailure(failures, {
      domain: "graph",
      kind: "proof-conflict",
      detail: graph.inputProofFailures.get(spelling),
      path: spelling,
    });
  }
  for (const spelling of graph.memberSpellings) {
    const proof = graph.inputProofs.get(spelling);
    if (isTransformScratchInput(spelling, cached.scratchDirectory)) {
      continue;
    }
    if (predicateConflictSpellings.has(spelling)) {
      continue;
    }
    if (graph.inputProofConflicts.has(spelling)) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind: "proof-conflict",
        detail: graph.inputProofFailures.get(spelling),
        path: spelling,
      });
      continue;
    }
    if (graph.inputProofFailures.has(spelling)) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind: "proof-missing",
        detail: graph.inputProofFailures.get(spelling),
        path: spelling,
      });
      continue;
    }
    const observation = graph.inputObservations.get(spelling);
    if (observation !== undefined && proof !== undefined) {
      const projection = legacyProjectionOfGraphInputObservation(observation);
      if (
        projection.failure !== undefined ||
        projection.hash !== proof.hash ||
        !sameHostInputRealpath(
          projection.realpath,
          proof.realpath,
          state.identityContext,
        )
      ) {
        recordGenerationProofFailure(failures, {
          domain: "graph",
          kind: "proof-conflict",
          detail: projection.failure,
          path: spelling,
        });
      }
      // The rich predicates were already replayed above. Their legacy
      // projection is an internal producer-consistency check, never a reason
      // to read the same filesystem input again. A projection that cannot
      // represent the observation is itself inconsistent with a supplied
      // legacy proof, rather than permission to trust either representation.
      continue;
    }
    if (
      graph.speculative.has(spelling) &&
      predicateSpellings.has(spelling) &&
      !graph.inputProofFailures.has(spelling)
    ) {
      continue;
    }
    // A legacy sidecar can report a resolver candidate without a compiler
    // predicate. Validate it against the generation snapshot instead.
    if (proof === undefined && graph.speculative.has(spelling)) {
      continue;
    }
    if (proof === undefined) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind: "proof-missing",
        detail: graph.inputProofFailures.get(spelling),
        path: spelling,
      });
      continue;
    }
    const currentHash = graphInputStateHash(proof.path, filesystem);
    if (currentHash !== proof.hash) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind: "content-changed",
        path: proof.path,
      });
    }
    if (
      !sameHostInputRealpath(
        proof.realpath,
        hostInputRealpath(proof.path, filesystem),
        state.identityContext,
      )
    ) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind: "realpath-changed",
        path: proof.path,
      });
    }
  }
  return failures;
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
  const observation = cached.externalInputObservations?.[path.resolve(input)];
  if (observation !== undefined) {
    return matchesGraphInputObservation(
      input,
      observation,
      filesystem,
      state.identityContext,
    );
  }
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
    return recorded === (current ?? MISSING_INPUT_STATE);
  } catch {
    return recorded === MISSING_INPUT_STATE;
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
  policy?: ITtscProjectMembershipPolicy,
): Record<string, string> {
  return collectProjectInputHashSnapshot(
    projectRoot,
    identities,
    filesystem,
    policy,
  ).hashes;
}

/** One project-walk hash set together with its completeness proof. */
export interface TtscProjectInputHashSnapshot {
  complete: boolean;
  hashes: Record<string, string>;
}

/**
 * Hash the project walk and retain whether every attempted directory and file
 * was observed coherently. Cache-key hosts must reject an incomplete set.
 */
export function collectProjectInputHashSnapshot(
  projectRoot: string,
  identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  policy?: ITtscProjectMembershipPolicy,
): TtscProjectInputHashSnapshot {
  const snapshot = collectProjectInputSnapshot(
    projectRoot,
    identities,
    filesystem,
    undefined,
    {
      policy,
    },
  );
  return {
    complete: snapshot.complete && snapshot.directoryComplete,
    hashes: snapshot.hashes,
  };
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
  options?: {
    /**
     * Restrict hashing to these project keys. Supplied by a validating caller,
     * which compares over exactly this set, and omitted by a capturing one,
     * which has no generation to compare against yet.
     */
    declaredKeys?: ReadonlySet<string>;
    /** What the resolved configuration admits into the program. */
    policy?: ITtscProjectMembershipPolicy;
  },
): {
  complete: boolean;
  directoryComplete: boolean;
  fileSignatures: Record<string, string>;
  hashes: Record<string, string>;
  projectDirectories: TtscProjectDirectorySnapshot[];
  provenSignatures: Record<string, string>;
  unstableFiles: Set<string>;
  walkFailures: TtscProjectWalkFailure[];
} {
  const hashes: Record<string, string> = {};
  const fileSignatures: Record<string, string> = {};
  const provenSignatures: Record<string, string> = {};
  const unstableFiles = new Set<string>();
  let attributed = true;
  const walked = walkProjectInputs(projectRoot, filesystem, options?.policy);
  const walkFailures = [...walked.failures];
  let complete = walked.complete;
  for (const file of walked.files) {
    try {
      const key = toProjectKey(projectRoot, file, identities);
      // A caller validating a generation compares hashes over that
      // generation's declared inputs alone (`sameHashes` takes the declared key
      // set), so reading anything else is work whose result is never consulted.
      // Skipping it is what keeps a directory full of emitted files from
      // costing a read per file on the pass that first sees them
      // (samchon/ttsc#1307). Capture passes supply no restriction and still
      // record the whole walk.
      if (
        options?.declaredKeys !== undefined &&
        !options.declaredKeys.has(key)
      ) {
        continue;
      }
      const before = inputMetadataEvidence(file, filesystem);
      // A file whose signature still equals the one captured around the read
      // that produced the recorded hash carries that content, so the whole
      // project does not have to be re-read to prove one delivery. Recheck the
      // clock ordering as well: rollback can make a formerly safe floor unable
      // to answer for a new write (samchon/ttsc#1344).
      if (
        before !== undefined &&
        before.separable &&
        proven !== undefined &&
        proven.signatures[key] === before.signature &&
        Object.prototype.hasOwnProperty.call(proven.hashes, key)
      ) {
        hashes[key] = proven.hashes[key]!;
        fileSignatures[key] = before.signature;
        provenSignatures[key] = before.signature;
        continue;
      }
      const contents = filesystem.readFile(file);
      const after = inputMetadataSignature(file, filesystem);
      hashes[key] = hashText(contents);
      if (
        before === undefined ||
        after === undefined ||
        before.signature !== after
      ) {
        complete = false;
        unstableFiles.add(key);
        walkFailures.push({ kind: "file-changed-during-read", path: file });
      } else {
        fileSignatures[key] = after;
        // Only a signature whose stamp's tick the filesystem's clock provably
        // left before this read may later stand in for the content comparison
        // ({@link stampSeparable}); the raw signature above still participates
        // in the generation-time stability comparison.
        if (before.separable) {
          provenSignatures[key] = after;
        }
      }
    } catch {
      // File watchers may observe a transform while another process is moving
      // or deleting files. The missing key invalidates older cache entries.
      complete = false;
      walkFailures.push({ kind: "file-read-failed", path: file });
      try {
        unstableFiles.add(toProjectKey(projectRoot, file, identities));
      } catch {
        // Without a key the failure cannot be attributed, so it keeps the
        // whole snapshot incomplete rather than being scoped away.
        attributed = false;
      }
    }
  }
  return {
    complete,
    directoryComplete: walked.complete && attributed,
    fileSignatures,
    hashes,
    projectDirectories: walked.directories,
    provenSignatures,
    unstableFiles,
    walkFailures,
  };
}

/**
 * Enumerate every regular file under `root`, skipping the directories no
 * configuration can name ({@link isIgnoredProjectDirectory}) and the ones the
 * resolved configuration excludes ({@link isExcludedProjectDirectory}).
 *
 * Uses an iterative DFS instead of `fs.readdirSync` recursion to avoid
 * unbounded call-stack depth on deep project trees. The result is sorted so
 * that hash comparisons are deterministic across OS-level directory orderings.
 */
function walkProjectInputs(
  root: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  policy: ITtscProjectMembershipPolicy = PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
): {
  complete: boolean;
  directories: TtscProjectDirectorySnapshot[];
  failures: TtscProjectWalkFailure[];
  files: string[];
} {
  let complete = true;
  const failures: TtscProjectWalkFailure[] = [];
  const files: string[] = [];
  // Collected in one pass, then digested in a second. A directory's digest has
  // to know whether each child directory can hold program inputs, and the walk
  // learns that only after descending, so the two cannot be one pass.
  const visited: {
    childDirectories: string[];
    entries: { name: string; kind: string; possible: boolean }[];
    ownInput: boolean;
    path: string;
    stable: string | undefined;
  }[] = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    const before = projectDirectorySignature(current, filesystem);
    if (before === undefined) {
      complete = false;
      failures.push({
        kind: "directory-metadata-unavailable",
        path: current,
      });
      continue;
    }
    let entries: fs.Dirent[];
    try {
      entries = filesystem.readdir(current);
    } catch {
      complete = false;
      failures.push({ kind: "directory-read-failed", path: current });
      continue;
    }
    const after = projectDirectorySignature(current, filesystem);
    if (after === undefined || before !== after) {
      complete = false;
      failures.push({
        kind:
          after === undefined
            ? "directory-metadata-unavailable"
            : "directory-changed-during-walk",
        path: current,
      });
    }
    const visit = {
      childDirectories: [] as string[],
      entries: [] as { name: string; kind: string; possible: boolean }[],
      ownInput: false,
      path: current,
      // If membership moved during enumeration, force the next delivery to
      // replace this generation instead of blessing a torn directory/file
      // snapshot as stable.
      stable:
        after !== undefined && before === after
          ? undefined
          : `unstable:${before}:${after ?? "missing"}`,
    };
    for (const entry of entries) {
      if (isIgnoredProjectDirectory(entry.name)) {
        continue;
      }
      const file = path.join(current, entry.name);
      if (entry.isDirectory() && isExcludedProjectDirectory(file, policy)) {
        continue;
      }
      const possible = isPossibleProgramEntry(entry, policy);
      visit.entries.push({
        kind: [
          entry.isDirectory(),
          entry.isFile(),
          entry.isSymbolicLink(),
        ].join(":"),
        name: entry.name,
        possible,
      });
      if (entry.isDirectory()) {
        visit.childDirectories.push(file);
        stack.push(file);
      } else if (entry.isFile() && possible) {
        // Only a file that could enter the program is hashed. A file that
        // could not is either irrelevant to every generation, or it is one the
        // compiler actually read, in which case the graph reports it and
        // `isProjectWalkPath` now agrees it is out of the walk, so it is
        // recorded and proven by the out-of-walk snapshot instead. Hashing an
        // emitted tree here bought nothing and cost a read per file, including
        // in `@ttsc/metro`, whose fingerprint re-keys every transformed file
        // (samchon/ttsc#1307).
        files.push(file);
        visit.ownInput = true;
      }
    }
    visited.push(visit);
  }

  // A directory matters to program membership only if its subtree can hold a
  // program input. Propagate that up from the directories that hold one, so a
  // bundler creating `out/` and filling it with JavaScript a project admitting
  // none can never compile is not a membership change at any level: not in the
  // directory itself, and not in the parent that now lists it
  // (samchon/ttsc#1307).
  const byPath = new Map(visited.map((visit) => [visit.path, visit]));
  const relevant = new Set<string>();
  for (const visit of visited) {
    if (!visit.ownInput) {
      continue;
    }
    let current: string | undefined = visit.path;
    while (current !== undefined && !relevant.has(current)) {
      relevant.add(current);
      const parent = path.dirname(current);
      current = parent === current || !byPath.has(parent) ? undefined : parent;
    }
  }

  const directories: TtscProjectDirectorySnapshot[] = visited.map((visit) => {
    const membership = visit.entries
      .filter(
        (entry) =>
          entry.possible &&
          (!visit.childDirectories.includes(
            path.join(visit.path, entry.name),
          ) ||
            relevant.has(path.join(visit.path, entry.name))),
      )
      .map((entry) => `${entry.name}:${entry.kind}`);
    return {
      path: visit.path,
      relevant: relevant.has(visit.path),
      signature:
        visit.stable ??
        hashText(membership.sort().join(String.fromCharCode(0))),
    };
  });
  directories.sort((left, right) => left.path.localeCompare(right.path));
  files.sort();
  return { complete, directories, failures, files };
}

/**
 * Return a directory's metadata stamp, used to detect that its membership moved
 * _while_ the walk was enumerating it.
 *
 * This is the right instrument for that job and the wrong one for comparing two
 * generations: it moves for ignored entries too. {@link walkProjectInputs}
 * records the filtered membership digest for the comparison instead.
 */
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
  // Compare only the directories that can hold program inputs, on either side.
  // A directory irrelevant on both is not part of the program's membership at
  // all, so its appearance, disappearance or churn says nothing: that is a
  // bundler's output tree. One that gained or lost relevance is present in the
  // comparison from the side where it counts, and so is caught.
  const select = (
    snapshots: readonly TtscProjectDirectorySnapshot[],
  ): Map<string, TtscProjectDirectorySnapshot> =>
    new Map(
      snapshots
        .filter((directory) => directory.relevant)
        .map((directory) => [directory.path, directory]),
    );
  const leftRelevant = select(left);
  const rightRelevant = select(right);
  const paths = new Set([...leftRelevant.keys(), ...rightRelevant.keys()]);
  for (const location of paths) {
    if (
      leftRelevant.get(location)?.signature !==
      rightRelevant.get(location)?.signature
    ) {
      return false;
    }
  }
  return true;
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

/** Detach and close every watcher, then preserve the first cleanup failure. */
function closeDirectoryWatches(watchers: { close: () => void }[]): void {
  const owned = watchers.splice(0);
  let failed = false;
  let failure: unknown;
  for (const watcher of owned) {
    try {
      watcher.close();
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  if (failed) throw failure;
}

/** Watch every walked directory for membership changes after generation. */
async function createProjectMutationTracker(
  directories: readonly TtscProjectDirectorySnapshot[],
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  policy: ITtscProjectMembershipPolicy = PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
): Promise<TtscProjectMutationTracker> {
  const tracker: TtscProjectMutationTracker = {
    changes: new Set(),
    changesOmitted: false,
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
      (location, filename) =>
        reportsProgramMembership(
          path.join(location, filename),
          filename,
          policy,
          filesystem,
        ),
    );
    return tracker;
  }
  const watchers: { close: () => void }[] = [];
  tracker.close = () => closeDirectoryWatches(watchers);
  for (const directory of directories) {
    try {
      watchers.push(
        openDirectoryWatch(
          filesystem,
          directory.path,
          (eventType, filename) => {
            if (eventType !== "rename") {
              return;
            }
            if (
              filename !== null &&
              !reportsProgramMembership(
                path.join(directory.path, filename),
                filename,
                policy,
                filesystem,
              )
            ) {
              return;
            }
            recordProjectMutation(
              tracker,
              filename === null
                ? directory.path
                : path.join(directory.path, filename),
            );
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
  filesystem: TtscTransformFilesystemOperations,
  covered: ReadonlySet<string>,
  events: "all" | "rename" = "all",
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
    changes: new Set(),
    changesOmitted: false,
    close: () => undefined,
    // Coverage is the caller's claim, and it is required rather than derived
    // from the input list: an input is watched by its exact name here, but only
    // the caller knows whether the path leading to it is watched as well, which
    // is what a later validation needs before it trusts the watcher instead of
    // probing the path again. Deriving it here would hand that claim to every
    // future caller by default (samchon/ttsc#1261).
    covered,
    failed: false,
    membershipChanged: false,
  };
  if (process.platform === "win32" && filesystem.watch === undefined) {
    await registerWindowsProjectMutationTracker(
      tracker,
      locations,
      events === "all",
      filesystem,
    );
    return tracker;
  }
  const watchers: { close: () => void }[] = [];
  tracker.close = () => closeDirectoryWatches(watchers);
  for (const location of locations) {
    try {
      const names = new Set(location.names);
      const caseSensitive = identities.caseSensitive(location.directory);
      watchers.push(
        openDirectoryWatch(
          filesystem,
          location.directory,
          (eventType, filename) => {
            if (events === "rename" && eventType !== "rename") {
              return;
            }
            const reported =
              filename === null
                ? null
                : normalizeHostInputName(filename, caseSensitive);
            if (reported === null || names.has(reported)) {
              recordProjectMutation(
                tracker,
                filename === null
                  ? location.directory
                  : path.join(location.directory, filename),
              );
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

/**
 * Whether a path lies inside a directory the configuration excludes.
 *
 * Lexical, exactly like the walk and like {@link isProjectWalkPath}, and for the
 * reason that predicate states: walk membership is lexical, so resolving a path
 * to physical identity first would collapse two spellings the walk keeps apart
 * and claim it covered a subtree it never followed. A junction whose target the
 * walk hashes under its own name is exactly that, and canonicalizing here would
 * suppress every event in it.
 *
 * `strictly` excludes an exact match, for the case where the excluded entry
 * names a file rather than a directory: `exclude` accepts one, the walk applies
 * exclusion to directories alone, so that file is still hashed and its events
 * must keep counting.
 */
function insideExcludedProjectDirectory(
  location: string,
  policy: ITtscProjectMembershipPolicy,
  strictly: boolean,
): boolean {
  if (policy.excludedDirectories.length === 0) {
    return false;
  }
  const resolved = path.resolve(location);
  return policy.excludedDirectories.some((excluded) => {
    const target = path.resolve(excluded);
    if (strictly && target === resolved) {
      return false;
    }
    return pathIsWithin(resolved, target);
  });
}

/**
 * Whether one directory event can be a change to the program's membership.
 *
 * The live tracker has to answer the same question the membership digest does,
 * or the two disagree about the same project: a bundler writing content-hashed
 * output fires a rename per rebuild, and treating that as membership kept the
 * cost samchon/ttsc#1307 removes on every host that has no build boundary,
 * which is every host the narrow path exists for.
 *
 * A name that could be a program input counts, unless it sits under a directory
 * the walk never descends into. A name that could not still counts when the
 * path is now a directory, because the walk's watches were opened for the
 * directories that existed when the generation was captured, so a directory
 * created since is not watched and the sources that may appear in it would
 * otherwise be invisible. A directory the configuration excludes is the
 * exception: the walk cannot see inside it, so the tracker must not either, or
 * emptying and recreating an `outDir` costs a compile per build. An event whose
 * name the host did not report is unattributable and always counts.
 */
function reportsProgramMembership(
  location: string,
  filename: string,
  policy: ITtscProjectMembershipPolicy,
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  if (isPossibleProgramFileName(filename, policy)) {
    // A name the program could admit. It still says nothing if it lies inside a
    // directory the walk never descends into, because the digest cannot see
    // there either and the tracker must not be the one side that reacts.
    return !insideExcludedProjectDirectory(location, policy, true);
  }
  let directory: boolean;
  try {
    directory = filesystem.lstat(location).isDirectory();
  } catch {
    // Gone again, or unreadable. Its name could not have been a program input,
    // and a directory removed under this one reports its own contents leaving
    // through the watch that was opened on it.
    return false;
  }
  if (!directory) {
    return false;
  }
  // A directory counts, because it can hold sources and the tracker is not
  // watching it yet, unless the configuration says the program does not contain
  // it. Emptying and recreating an `outDir`, which is what `emptyOutDir` and
  // `output.clean` do on every build, would otherwise void the generation once
  // per build on every host that has no build boundary.
  return !insideExcludedProjectDirectory(location, policy, false);
}

/** Record enough exact mutation evidence without retaining an event stream. */
function recordProjectMutation(
  tracker: TtscProjectMutationTracker,
  changed: string,
): void {
  tracker.membershipChanged = true;
  if (tracker.changes.has(changed)) return;
  if (tracker.changes.size < MAX_GENERATION_MUTATION_PATHS) {
    tracker.changes.add(changed);
  } else {
    tracker.changesOmitted = true;
  }
}

interface WindowsProjectMutationBroker {
  child: ChildProcess;
  /** Round-trips awaiting the child's reply, by request id. */
  drains: Map<number, () => void>;
  /** The acknowledgement currently in flight, shared by every waiter. */
  draining?: Promise<void>;
  nextId: number;
  pendingDrains: number;
  pendingRegistrations: number;
  trackers: Map<
    number,
    {
      /**
       * Whether one named event can be a program membership change. Present
       * only for the project-directory tracker, which watches whole directories
       * and so has to narrow what it hears; the trackers that watch exact names
       * have already narrowed theirs by construction.
       */
      membership?: (location: string, filename: string) => boolean;
      ready: () => void;
      /**
       * The walk's own spelling for each canonical directory the child watches,
       * so a reported event can be translated back before anything compares it
       * with a path the walk or the configuration produced.
       *
       * Required, not optional. A registration that forgot it would fall back
       * to the child's canonical spelling and silently reintroduce the mismatch
       * this map exists to remove, with no type error and no failing test.
       */
      spellings: ReadonlyMap<string, string>;
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
  /**
   * Optional filter for the project-directory tracker, whose events have to be
   * narrowed to program membership exactly as the in-process watcher's are. The
   * name-watching trackers pass none, since they already watch exact names.
   */
  membership?: (location: string, filename: string) => boolean,
): Promise<void> {
  const broker = getWindowsProjectMutationBroker();
  // The child watches canonical directories, and reports its events under that
  // spelling. Everything else in the adapter speaks the walk's own spelling,
  // which on Windows can be an 8.3 short form of the same directory, so keep
  // the way back: a filter that compared the child's spelling against the
  // configuration's would be comparing two names for one directory that share
  // no common prefix (samchon/ttsc#1307).
  const spellings = new Map<string, string>();
  const normalized = locations.map((location) => {
    let directory: string;
    try {
      directory = filesystem.realpath(location.directory);
    } catch {
      directory = path.resolve(location.directory);
    }
    spellings.set(directory, location.directory);
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
  broker.trackers.set(id, {
    membership,
    ready: resolveReady,
    spellings,
    tracker,
  });
  tracker.drain = () => drainWindowsProjectMutationBroker(broker);
  tracker.close = () => {
    const active = broker.trackers.get(id);
    if (active === undefined) return;
    broker.trackers.delete(id);
    active.ready();
    let failed = false;
    let failure: unknown;
    try {
      broker.child.send?.({ id, op: "remove" });
    } catch (error) {
      failed = true;
      failure = error;
    }
    if (broker.trackers.size === 0) {
      if (windowsProjectMutationBroker === broker) {
        windowsProjectMutationBroker = undefined;
      }
      try {
        broker.child.disconnect?.();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
      try {
        broker.child.kill();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
    if (failed) throw failure;
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
    // `ref`/`unref` is a flag rather than a counter, so this must not clear a
    // reference an in-flight acknowledgement is holding: a delivery waiting on
    // a reply over an unreferenced channel lets the loop empty and the process
    // exit mid-build.
    if (broker.pendingRegistrations === 0 && broker.pendingDrains === 0) {
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
    drains: new Map(),
    nextId: 1,
    pendingDrains: 0,
    pendingRegistrations: 0,
    trackers: new Map(),
  };
  const fail = (): void => {
    for (const registration of broker.trackers.values()) {
      registration.tracker.failed = true;
      registration.ready();
    }
    broker.trackers.clear();
    // A broker that died answers no round-trip. Release every waiter instead of
    // stalling the deliveries behind them; their trackers are failed now, so
    // validation falls back to proving the generation from its own state.
    for (const release of broker.drains.values()) release();
    broker.drains.clear();
    if (windowsProjectMutationBroker === broker) {
      windowsProjectMutationBroker = undefined;
    }
  };
  child.on("error", fail);
  child.on("exit", fail);
  child.on("message", (message: unknown) => {
    if (message === null || typeof message !== "object") return;
    const record = message as {
      directory?: string;
      drained?: boolean;
      failed?: boolean;
      filename?: string | null;
      id?: number;
      ready?: boolean;
    };
    if (typeof record.id !== "number") return;
    if (record.drained === true) {
      // Every event the child had already sent arrived before this reply, since
      // one IPC channel delivers in order.
      const release = broker.drains.get(record.id);
      broker.drains.delete(record.id);
      release?.();
      return;
    }
    const registration = broker.trackers.get(record.id);
    if (registration === undefined) return;
    if (record.failed === true) registration.tracker.failed = true;
    if (record.ready === true) registration.ready();
    if (record.ready !== true && record.failed !== true) {
      if (typeof record.directory === "string") {
        // The walk's spelling for this directory, which is what every
        // comparison and every recorded witness downstream expects.
        const reported =
          registration.spellings.get(record.directory) ?? record.directory;
        if (
          typeof record.filename === "string" &&
          registration.membership !== undefined &&
          !registration.membership(reported, record.filename)
        ) {
          return;
        }
        recordProjectMutation(
          registration.tracker,
          typeof record.filename === "string"
            ? path.join(reported, record.filename)
            : reported,
        );
      } else {
        registration.tracker.membershipChanged = true;
      }
    }
  });
  windowsProjectMutationBroker = broker;
  return broker;
}

/**
 * Ask the Windows broker to acknowledge, and resolve when it does.
 *
 * The child answers after a turn of its own loop, so a watch callback it had
 * already queued has run, and the ordered IPC channel puts every message it
 * sent before the reply ahead of the reply. That is the same proof an
 * in-process watcher gets from a macrotask turn, rather than the fixed wait
 * this replaces, which guessed at the crossing (samchon/ttsc#1272).
 *
 * A broker that never answers must not hold a delivery: the wait falls back to
 * the previous fixed grace, after which validation proceeds against whatever
 * the tracker knows, exactly as it did before.
 */
function drainWindowsProjectMutationBroker(
  broker: WindowsProjectMutationBroker,
): Promise<void> {
  // Every tracker of a generation lives in one broker, so one acknowledgement
  // answers for all of them. Sharing the in-flight round-trip keeps a settle to
  // a single crossing.
  broker.draining ??= startWindowsProjectMutationDrain(broker).finally(() => {
    broker.draining = undefined;
  });
  return broker.draining;
}

function startWindowsProjectMutationDrain(
  broker: WindowsProjectMutationBroker,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const id = broker.nextId++;
    let settled = false;
    const release = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      broker.drains.delete(id);
      broker.pendingDrains -= 1;
      if (broker.pendingDrains === 0 && broker.pendingRegistrations === 0) {
        broker.child.unref();
        broker.child.channel?.unref();
      }
      resolve();
    };
    // Hold the channel open while the acknowledgement is outstanding. The
    // broker is unreferenced between requests so it never keeps a host alive,
    // and a reply is the only thing this promise can be resolved by: without
    // the reference the loop can empty while a delivery waits here, and the
    // process exits mid-build with nothing to report.
    broker.pendingDrains += 1;
    broker.child.ref();
    broker.child.channel?.ref();
    const timer = setTimeout(release, WINDOWS_MUTATION_DRAIN_FALLBACK_MS);
    broker.drains.set(id, release);
    if (broker.child.send?.({ id, op: "drain" }) !== true) {
      release();
    }
  });
}

/** The wait a broker that stopped answering degrades to. */
const WINDOWS_MUTATION_DRAIN_FALLBACK_MS = 10;

const WINDOWS_WATCH_BROKER_SOURCE = [
  'const fs = require("node:fs");',
  "const groups = new Map();",
  'process.on("message", (message) => {',
  '  if (message.op === "drain") {',
  // Two turns, not one: the first lets the loop poll for watch completions the
  // kernel had already queued, the second answers after their callbacks ran.
  "    setImmediate(() => setImmediate(() => process.send?.({ drained: true, id: message.id })));",
  "    return;",
  "  }",
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
  '        if (matches && (message.allEvents || event === "rename")) process.send?.({ directory: location.directory, filename: filename === null ? null : String(filename), id: message.id });',
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
    cached.hostInputMutationTracker?.membershipChanged === true ||
    cached.candidateMutationTracker?.membershipChanged === true
  );
}

/**
 * Report whether the live notifications can still prove membership. A watcher
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
  // The candidate tracker is optional: a generation with no absent candidate
  // opens none, and one that declined to watch them left the per-delivery probe
  // in place. Only a tracker that exists and has failed withdraws the proof.
  return cached.candidateMutationTracker?.failed !== true;
}

/**
 * Yield to the loop the tracker's own watcher callbacks are queued on.
 *
 * Two turns for the same reason the broker takes two: the first gives the loop
 * a poll phase for completions the kernel had already queued, the second runs
 * after the callbacks they produced.
 */
function drainOnNextTurn(): Promise<void> {
  return new Promise<void>((resolve) =>
    setImmediate(() => setImmediate(resolve)),
  );
}

/**
 * Settle every notification the trackers' watchers have already dispatched,
 * before persistent validation reads their verdict.
 *
 * A synchronous edit returns before its watch event is applied, so without this
 * a delivery could validate against a tracker that has not been told yet. Each
 * tracker drains through its own channel, which is a macrotask turn for a
 * watcher on this loop and an ordered round-trip for one inside the Windows
 * broker. Concurrent sibling deliveries share the barrier one of them started.
 */
async function settleProjectMutationEvents(
  cached: TtscCachedProjectTransform,
): Promise<void> {
  const trackers = [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ].filter(
    (tracker): tracker is TtscProjectMutationTracker => tracker !== undefined,
  );
  await Promise.all(
    trackers.map(async (tracker) => {
      tracker.settle ??= (tracker.drain ?? drainOnNextTurn)().finally(() => {
        tracker.settle = undefined;
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
  policy: ITtscProjectMembershipPolicy = PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
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
  // The last segment is the file itself, which the walk names rather than
  // descends into, so only the directory components decide walk membership.
  if (segments.slice(0, -1).some(isIgnoredProjectDirectory)) {
    return false;
  }
  if (isExcludedProjectDirectory(path.dirname(path.resolve(file)), policy)) {
    return false;
  }
  // The walk hashes only files that could enter the program, so a path it does
  // not hash is out of the walk by definition. Answering otherwise would leave
  // a graph input the compiler really read in neither snapshot: absent from
  // `inputHashes` because the walk skipped it, and absent from the out-of-walk
  // snapshot because this predicate claimed the walk covered it.
  if (!isPossibleProgramFileName(path.basename(file), policy)) {
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
    hashes[identity] =
      hostInputStateHash(file, filesystem) ?? MISSING_INPUT_STATE;
  }
  return hashes;
}

/** Capture the stable file predicate used by implicit project discovery. */
export function captureWatchInputFileBaseline(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): TtscWatchInputFileBaseline | undefined {
  const capture = (): TtscWatchInputFileBaseline => {
    const identities = createHostPathIdentityContext(filesystem);
    let fileExists = false;
    try {
      fileExists = filesystem.stat(file).isFile();
    } catch {
      // Project discovery rejects every candidate not proven to be a file.
    }
    return {
      fileExists,
      identity: pathIdentityKey(file, identities),
    };
  };
  try {
    const before = capture();
    const after = capture();
    return stableStringify(before) === stableStringify(after)
      ? after
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Capture one stable main-process baseline that can be compared with any
 * generation-owned watch-input evidence. Two equal broad observations are
 * required so a cache key never publishes a torn path state.
 */
export function captureWatchInputBaseline(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): TtscWatchInputBaseline | undefined {
  const capture = (): TtscWatchInputBaseline => {
    const identities = createHostPathIdentityContext(filesystem);
    const stat = compilerStatKind(file, filesystem);
    return {
      directoryExists: stat === "directory",
      fileExists: stat === "file",
      graphHash: graphInputStateHash(file, filesystem) ?? MISSING_INPUT_STATE,
      graphReadHash: graphInputReadHash(file, filesystem),
      hostHash: hostInputStateHash(file, filesystem) ?? MISSING_INPUT_STATE,
      identity: pathIdentityKey(file, identities),
      realpath: compilerInputRealpathObservation(file, filesystem),
      stat,
    };
  };
  try {
    const before = capture();
    const after = capture();
    return stableStringify(before) === stableStringify(after)
      ? after
      : undefined;
  } catch {
    return undefined;
  }
}

/** Compare generation evidence with the main process's exact key baseline. */
export function watchInputEvidenceMatchesBaseline(
  evidence: TtscWatchInputEvidence,
  baseline: TtscWatchInputKeyBaseline,
): boolean {
  if (
    !isWatchInputKeyBaseline(baseline) ||
    evidence.identity !== baseline.identity ||
    evidence.state === undefined
  ) {
    return false;
  }
  const broad = broadWatchInputBaseline(baseline);
  if (evidence.state.codec === "host") {
    return broad !== undefined && evidence.state.hash === broad.hostHash;
  }
  const identities = createHostPathIdentityContext();
  if (evidence.state.codec === "graph") {
    return (
      broad !== undefined &&
      evidence.state.hash === broad.graphHash &&
      sameHostInputRealpath(
        evidence.state.realpath,
        broad.realpath.ok ? broad.realpath.path : null,
        identities,
      )
    );
  }
  const observation = evidence.state.observation;
  if (
    observation.fileExists !== undefined &&
    observation.fileExists !== baseline.fileExists
  ) {
    return false;
  }
  if (
    observation.directoryExists !== undefined &&
    (broad === undefined ||
      observation.directoryExists !== broad.directoryExists)
  ) {
    return false;
  }
  if (
    observation.stat !== undefined &&
    (broad === undefined || observation.stat !== broad.stat)
  ) {
    return false;
  }
  if (
    observation.readFile !== undefined &&
    (broad === undefined ||
      (observation.readFile.ok &&
        observation.readFile.hash !== broad.graphReadHash) ||
      (!observation.readFile.ok && broad.graphReadHash !== null))
  ) {
    return false;
  }
  if (observation.realpath !== undefined) {
    if (broad === undefined) {
      return false;
    }
    if (observation.realpath.ok !== broad.realpath.ok) {
      return false;
    }
    if (
      observation.realpath.ok &&
      broad.realpath.ok &&
      !sameHostInputRealpath(
        observation.realpath.path,
        broad.realpath.path,
        identities,
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Validate the complete narrow or broad shape stored in a key baseline. */
export function isWatchInputKeyBaseline(
  baseline: unknown,
): baseline is TtscWatchInputKeyBaseline {
  if (!isPlainRecord(baseline)) return false;
  const keys = Object.keys(baseline).sort();
  if (
    typeof baseline.fileExists !== "boolean" ||
    typeof baseline.identity !== "string" ||
    !isAbsoluteFilesystemPath(baseline.identity)
  ) {
    return false;
  }
  if (stableStringify(keys) === stableStringify(["fileExists", "identity"])) {
    return true;
  }
  if (
    stableStringify(keys) !==
    stableStringify([
      "directoryExists",
      "fileExists",
      "graphHash",
      "graphReadHash",
      "hostHash",
      "identity",
      "realpath",
      "stat",
    ])
  ) {
    return false;
  }
  if (
    typeof baseline.directoryExists !== "boolean" ||
    !isWatchInputStateHash(baseline.graphHash) ||
    !(
      baseline.graphReadHash === null || isContentHash(baseline.graphReadHash)
    ) ||
    !isWatchInputStateHash(baseline.hostHash) ||
    !isWatchInputRealpathBaseline(baseline.realpath) ||
    (baseline.stat !== "directory" &&
      baseline.stat !== "file" &&
      baseline.stat !== "missing")
  ) {
    return false;
  }
  return (
    baseline.fileExists === (baseline.stat === "file") &&
    baseline.directoryExists === (baseline.stat === "directory")
  );
}

/** Whether an unknown value is one ordinary JSON object. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Whether one identity can name an absolute path on either supported syntax. */
function isAbsoluteFilesystemPath(value: string): boolean {
  return path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
}

/** Whether a serialized hash is a content digest. */
function isContentHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/** Whether a baseline state is either a digest or the missing marker. */
function isWatchInputStateHash(value: unknown): value is string {
  return value === MISSING_INPUT_STATE || isContentHash(value);
}

/** Validate the serialized Realpath predicate as an exact discriminated union. */
function isWatchInputRealpathBaseline(
  value: unknown,
): value is TtscWatchInputBaseline["realpath"] {
  if (!isPlainRecord(value) || typeof value.ok !== "boolean") return false;
  const keys = Object.keys(value).sort();
  if (value.ok === false) {
    return stableStringify(keys) === stableStringify(["ok"]);
  }
  return (
    stableStringify(keys) === stableStringify(["ok", "path"]) &&
    typeof value.path === "string" &&
    isAbsoluteFilesystemPath(value.path)
  );
}

/** Return a broad baseline after the complete entry has been validated. */
function broadWatchInputBaseline(
  baseline: TtscWatchInputKeyBaseline,
): TtscWatchInputBaseline | undefined {
  return "directoryExists" in baseline ? baseline : undefined;
}

/**
 * Re-check a cached mixed graph/dependency input set with its owning codec,
 * reusing the recorded hash of any input whose metadata signature still holds
 * under a freshly minted same-device reference and reporting the signatures
 * this pass captured.
 *
 * The caller adopts those signatures only once every input is proven unchanged,
 * so a signature never outlives the content comparison that justified it.
 */
function matchesCachedExternalInputs(cached: TtscCachedProjectTransform): {
  matches: boolean;
  signatures: Record<string, string>;
} {
  const signatures: Record<string, string> = {};
  let matches = true;
  const state = envelopeDerivation(cached);
  const graphRealpaths = cached.externalInputRealpaths ?? {};
  const filesystem = resultFilesystem(cached.result);
  const recordedHashes = cached.externalInputHashes ?? {};
  const recordedSignatures = cached.externalInputSignatures ?? {};
  // Compare each spelling against the recorded state under its own name. Two
  // spellings share one identity exactly when they selected one physical file
  // at generation time, which is the state a retarget ends, so neither may
  // answer for the other: skipping the second would leave a retargeted alias
  // unvalidated, and comparing them only through a shared key would let
  // whichever came first decide.
  for (const file of cached.externalInputPaths ??
    Object.keys(cached.externalInputHashes ?? {})) {
    const identity = derivationIdentity(state, file);
    const spelling = path.resolve(file);
    const observation = cached.externalInputObservations?.[spelling];
    if (observation !== undefined) {
      if (
        !matchesGraphInputObservation(
          file,
          observation,
          filesystem,
          state.identityContext,
        )
      ) {
        matches = false;
      }
      continue;
    }
    // Reuse the recorded hash of an out-of-walk input whose signature still
    // equals the one captured around the read that proved it. The signature is
    // keyed by this exact spelling, so an alias of the same physical file
    // cannot answer for it.
    const before = inputMetadataEvidence(file, filesystem);
    if (
      before !== undefined &&
      Object.prototype.hasOwnProperty.call(recordedSignatures, spelling) &&
      Object.prototype.hasOwnProperty.call(recordedHashes, identity) &&
      before.separable &&
      before.signature === recordedSignatures[spelling]
    ) {
      continue;
    }
    const hash = Object.prototype.hasOwnProperty.call(graphRealpaths, identity)
      ? graphInputStateHash(file, filesystem)
      : hostInputStateHash(file, filesystem);
    const after = inputMetadataSignature(file, filesystem);
    if (
      !Object.prototype.hasOwnProperty.call(recordedHashes, identity) ||
      recordedHashes[identity] !== (hash ?? MISSING_INPUT_STATE)
    ) {
      matches = false;
    }
    if (
      hash !== null &&
      after !== undefined &&
      before?.signature === after &&
      before.separable
    ) {
      signatures[spelling] = after;
    }
  }
  return { matches, signatures };
}

/**
 * Derive the absolute out-of-walk input set of a whole project transform: the
 * union of every transformed source key, reference-graph member (edge keys and
 * targets, globals, the config chain), and plugin-reported dependency, minus
 * everything the project walk already hashes and the disposed transform scratch
 * tree. These are the inputs {@link matchesCachedSource}'s walk cannot see.
 * Resolution candidates that are still missing remain in this set even under
 * the project root: the first walk cannot hash a file that has not been created
 * yet.
 *
 * A `dependenciesComplete` declaration deliberately does not narrow the stored
 * set: other files in the same whole-project result can still own the omitted
 * members. Persistent validation selects the requested file's subset through
 * {@link selectWatchInputs}, while graph-free envelopes use this union as their
 * conservative fallback.
 */
function selectExternalInputPaths(props: {
  filesystem?: TtscTransformFilesystemOperations;
  membershipPolicy: ITtscProjectMembershipPolicy;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
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
  const graphState = envelopeDerivation({
    projectRoot: props.projectRoot,
    result: props.result,
  });
  const graphIndexes = envelopeGraphIndexes(graphState, {
    projectRoot: props.projectRoot,
    result: props.result,
  });
  // Every transform output key names the source file whose transformed text it
  // carries. Keep an out-of-walk source in the external snapshot instead of
  // injecting it into the project-walk key universe (samchon/ttsc#252).
  members.push(...Object.keys(props.result.typescript));
  if (graph !== undefined) {
    for (const [source, targets] of Object.entries(graph.edges ?? {})) {
      members.push(source);
      if (Array.isArray(targets)) {
        members.push(...targets);
      }
    }
    for (const listed of [
      graph.globals,
      graph.configs,
      graph.resolutionInputs,
    ]) {
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
        resolutionCandidates.add(path.resolve(absolute));
      }
    }
    for (const input of graph.resolutionInputs ?? []) {
      if (typeof input === "string" && input.length !== 0) {
        resolutionCandidates.add(path.resolve(props.projectRoot, input));
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
        resolutionCandidates.add(path.resolve(props.projectRoot, input));
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
    const observation = graphIndexes.inputObservations.get(spelling);
    const missingCandidate =
      resolutionCandidates.has(spelling) &&
      (observation?.fileExists === false ||
        (observation === undefined && !filesystem.exists(absolute)));
    if (
      identity === excluded ||
      isTransformScratchInput(absolute, props.scratchDirectory) ||
      seen.has(spelling) ||
      (!missingCandidate &&
        isProjectWalkPath(
          props.projectRoot,
          absolute,
          identities,
          filesystem,
          props.membershipPolicy,
        ))
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

/**
 * The generation's resolution candidates that do not exist, so its host-input
 * watcher can be told to announce their creation.
 *
 * A missing candidate is the one input class no proof can be memoized for: its
 * metadata cannot be read, so the signature shortcut that stands in for every
 * other input's comparison never applies, and every delivery that reaches it
 * probes the filesystem again. Watching the name instead turns that repeated
 * probe into one notification for the whole generation, using the same channel
 * and the same failure rules the universal inputs already run under
 * (samchon/ttsc#1261).
 *
 * Only absent candidates qualify. One that exists is validated by content and
 * physical identity like any other input, and adding it here would replace the
 * generation for a change that cannot affect a resolution the compiler already
 * declined to take.
 */
function selectNotifiableAbsentInputs(props: {
  filesystem: TtscTransformFilesystemOperations;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
  temporaryTsconfig?: string;
}): { candidates: string[]; watched: string[] } {
  const empty = { candidates: [], watched: [] };
  if (props.result.type === "exception") {
    return empty;
  }
  const graph = props.result.graph;
  if (graph === undefined) {
    return empty;
  }
  const identities = createHostPathIdentityContext(props.filesystem);
  const graphState = envelopeDerivation({
    projectRoot: props.projectRoot,
    result: props.result,
  });
  const graphIndexes = envelopeGraphIndexes(graphState, {
    projectRoot: props.projectRoot,
    result: props.result,
  });
  const excluded =
    props.temporaryTsconfig === undefined
      ? undefined
      : pathIdentityKey(props.temporaryTsconfig, identities);
  const resolvedProjectRoot = path.resolve(props.projectRoot);
  const output: string[] = [];
  const watched: string[] = [];
  const directories = new Set<string>();
  // Two namespaces, deliberately not one set: candidates are the paths a
  // delivery may stop probing, while the chain holds the directories that carry
  // them. Sharing a set would let one silently answer for the other.
  const seen = new Set<string>();
  const chain = new Set<string>();
  for (const candidates of [
    ...Object.values(graph.candidates ?? {}),
    graph.resolutionInputs ?? [],
  ]) {
    if (!Array.isArray(candidates)) {
      continue;
    }
    for (const candidate of candidates) {
      if (typeof candidate !== "string" || candidate.length === 0) {
        continue;
      }
      const absolute = path.resolve(props.projectRoot, candidate);
      const spelling = path.resolve(absolute);
      const observation = graphIndexes.inputObservations.get(spelling);
      const absentAsFile =
        observation?.fileExists === false ||
        (observation === undefined && !props.filesystem.exists(absolute));
      if (
        seen.has(spelling) ||
        isTransformScratchInput(absolute, props.scratchDirectory) ||
        (excluded !== undefined &&
          pathIdentityKey(absolute, identities) === excluded) ||
        !absentAsFile
      ) {
        continue;
      }
      seen.add(spelling);
      // Collect the components of the lexical path, by the name each carries in
      // its own parent. The watcher a missing path opens follows the spelling
      // to a physical directory, so retargeting a link along the way moves the
      // answer without touching what is watched: in a pnpm layout
      // `node_modules/<pkg>` is exactly such a link, and reinstalling it makes
      // a candidate appear behind a watch still looking at the old store
      // directory. Watching `<pkg>` inside `node_modules` is what reports that.
      //
      // The collection stops at the project root, and a spelling that leaves
      // the project subtree before reaching it is not claimed at all. Above
      // that line the components are the machine's own layout rather than the
      // project's, and watching those entries costs a generation whenever an
      // unrelated process touches anything inside them; a candidate whose path
      // runs outside the subtree therefore keeps the probe it always had rather
      // than a proof this cannot complete.
      const components: string[] = [];
      let reachedProject = false;
      for (
        let child = path.dirname(spelling), parent = path.dirname(child);
        parent !== child;
        child = parent, parent = path.dirname(child)
      ) {
        if (insideProject(child, resolvedProjectRoot)) {
          components.push(child);
          continue;
        }
        // Compared through `path.relative` rather than by string, so a
        // spelling that differs from the root only in case still counts as
        // having arrived where the platform says it has.
        reachedProject = path.relative(child, resolvedProjectRoot).length === 0;
        break;
      }
      if (!reachedProject) {
        continue;
      }
      output.push(absolute);
      watched.push(absolute);
      for (const component of components) {
        if (chain.has(component)) break;
        chain.add(component);
        watched.push(component);
        directories.add(path.dirname(component));
      }
      directories.add(path.dirname(spelling));
    }
  }
  if (directories.size > NOTIFIABLE_ABSENCE_DIRECTORY_LIMIT) {
    // Past this many distinct directories the watch registration is the more
    // expensive half: a host that runs out of watch descriptors fails the
    // tracker, and a failed tracker sends every delivery to complete-snapshot
    // validation, which re-hashes the whole project. Declining to watch leaves
    // the per-delivery probe in place, which is what this replaces and is far
    // cheaper than that.
    return empty;
  }
  output.sort();
  watched.sort();
  return { candidates: output, watched };
}

/**
 * Report whether a directory lies strictly below the project root.
 *
 * The boundary of what a generation may watch on a candidate's behalf: what the
 * project contains is its own layout, while the project root and everything
 * above it belongs to the machine, which nobody retargets and which changes for
 * reasons no generation should hear about.
 */
function insideProject(directory: string, projectRoot: string): boolean {
  const relative = path.relative(
    path.resolve(projectRoot),
    path.resolve(directory),
  );
  // An empty result is the platform saying the two name the same directory,
  // which it answers for spellings that differ only in case where the path
  // module folds case. The root itself is not below itself, so the walk stops
  // there rather than one level past it.
  if (relative.length === 0) {
    return false;
  }
  // `..` alone and `../` climb out, and an absolute answer means another drive
  // or share entirely; a directory literally named `..x` does neither, which a
  // plain prefix test would misread. The project walk's own containment check
  // spells it the same way.
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/**
 * Distinct directories the absent-candidate watch may open before it declines.
 *
 * Sized well below the inotify per-user default so a project's own walk keeps
 * its share, and far above the distinct `node_modules` package directories a
 * real dependency graph produces.
 *
 * Counted lexically, over the parents of every watched name. A missing subtree
 * collapses onto the one watch its nearest existing ancestor carries, so the
 * count is an upper bound on the watches actually opened rather than their
 * number; the bound stays sound and is merely not tight.
 */
const NOTIFIABLE_ABSENCE_DIRECTORY_LIMIT = 512;

/**
 * Whether the resolved configuration keeps this directory out of the program.
 *
 * Compared by physical containment rather than by name, so `outDir: "./dist"`
 * excludes that one directory instead of every directory called `dist` at every
 * depth, which is the distinction the name list could not draw.
 */
function isExcludedProjectDirectory(
  directory: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return insideExcludedProjectDirectory(directory, policy, false);
}

/**
 * Whether this entry could enter the program, and so whether its appearance or
 * removal is a membership change.
 *
 * A directory always could, since it can hold sources. A file could only if it
 * carries an extension the resolved configuration admits, which is what makes a
 * bundle emitted beside the sources invisible to a project that compiles no
 * JavaScript.
 */
function isPossibleProgramEntry(
  entry: fs.Dirent,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return entry.isFile() ? isPossibleProgramFileName(entry.name, policy) : true;
}

/** The same question for a bare file name, for callers holding no `Dirent`. */
function isPossibleProgramFileName(
  name: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  const lowered = name.toLowerCase();
  return policy.inputExtensions.some((extension) =>
    lowered.endsWith(extension),
  );
}

/**
 * Compare two project-walk snapshots.
 *
 * `keys` narrows the comparison to the generation's declared inputs. The walk
 * hashes every file under the project root, but only a file the compile
 * actually consumed can change an output, and a project root is a working
 * directory: a framework's generated types, a log, a coverage report, or a test
 * artifact appears and changes there while a compile runs. Comparing those
 * would declare the generation incoherent and cost a whole-project recompile
 * for every remaining module (samchon/ttsc#1246). Files entering or leaving the
 * project remain covered by the directory-membership snapshot, which is the one
 * thing a content comparison cannot see. An envelope that declares no input set
 * (a graph-free legacy host) passes `undefined` and keeps the whole-walk
 * comparison.
 */
function sameHashes(
  left: Record<string, string>,
  right: Record<string, string>,
  keys?: ReadonlySet<string>,
): boolean {
  if (keys !== undefined) {
    for (const key of keys) {
      if (left[key] !== right[key]) return false;
    }
    return true;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => right[key] === left[key]);
}

/**
 * Whether a project-walk snapshot is coherent for the inputs that matter.
 *
 * The walk reads every file under the project root, so a file nothing compiled
 * (a log being appended, a coverage report being written, a generated artifact
 * being replaced) can fail its own read sandwich while every input holds still.
 * That is not evidence about the generation, and treating it as such costs a
 * whole-project recompile per delivered module. A walk that could not enumerate
 * a directory, or a file-level failure this snapshot could not attribute to a
 * key, still taints everything: neither can be shown to leave the inputs
 * alone.
 */
function walkSnapshotComplete(
  snapshot: {
    complete: boolean;
    directoryComplete: boolean;
    unstableFiles: ReadonlySet<string>;
  },
  declared: ReadonlySet<string> | undefined,
): boolean {
  if (declared === undefined) {
    return snapshot.complete;
  }
  if (!snapshot.directoryComplete) {
    return false;
  }
  for (const key of snapshot.unstableFiles) {
    if (declared.has(key)) return false;
  }
  return true;
}

/** Preserve exact project-walk and mutation witnesses for one failed attempt. */
function recordProjectSnapshotFailures(
  failures: TtscGenerationProofFailures,
  props: {
    before: ReturnType<typeof collectProjectInputSnapshot>;
    candidateTracker?: TtscProjectMutationTracker;
    declared: ReadonlySet<string> | undefined;
    hostInputTracker?: TtscProjectMutationTracker;
    identities: FilesystemPathIdentityContext;
    projectRoot: string;
    snapshot: ReturnType<typeof collectProjectInputSnapshot>;
    tracker?: TtscProjectMutationTracker;
  },
): void {
  const recordWalk = (
    snapshot: ReturnType<typeof collectProjectInputSnapshot>,
  ): void => {
    for (const failure of snapshot.walkFailures) {
      if (failure.kind.startsWith("file-") && props.declared !== undefined) {
        try {
          const key = toProjectKey(
            props.projectRoot,
            failure.path,
            props.identities,
          );
          if (!props.declared.has(key)) continue;
        } catch {
          // An unidentifiable failed input taints the complete project walk.
        }
      }
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind: failure.kind,
        path: failure.path,
      });
    }
  };
  recordWalk(props.before);
  recordWalk(props.snapshot);

  const keys =
    props.declared ??
    new Set([
      ...Object.keys(props.before.hashes),
      ...Object.keys(props.snapshot.hashes),
    ]);
  for (const key of keys) {
    if (props.before.hashes[key] !== props.snapshot.hashes[key]) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind: "input-content-changed",
        path: path.resolve(props.projectRoot, key),
      });
    }
    if (
      props.before.fileSignatures[key] !== props.snapshot.fileSignatures[key]
    ) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind: "input-metadata-changed",
        path: path.resolve(props.projectRoot, key),
      });
    }
  }

  const leftDirectories = new Map(
    props.before.projectDirectories.map((entry) => [
      entry.path,
      entry.signature,
    ]),
  );
  const rightDirectories = new Map(
    props.snapshot.projectDirectories.map((entry) => [
      entry.path,
      entry.signature,
    ]),
  );
  for (const directory of new Set([
    ...leftDirectories.keys(),
    ...rightDirectories.keys(),
  ])) {
    if (leftDirectories.get(directory) !== rightDirectories.get(directory)) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind: "directory-membership-changed",
        path: directory,
      });
    }
  }

  const recordTracker = (
    tracker: TtscProjectMutationTracker | undefined,
    kind: string,
  ): void => {
    if (tracker?.membershipChanged !== true) return;
    if (tracker.changes.size === 0) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind,
        path: props.projectRoot,
      });
      return;
    }
    for (const changed of tracker.changes) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind,
        path: changed,
      });
    }
    if (tracker.changesOmitted) {
      failures.omitted = Math.min(
        Number.MAX_SAFE_INTEGER,
        failures.omitted + 1,
      );
    }
  };
  recordTracker(props.tracker, "project-membership-event");
  recordTracker(props.hostInputTracker, "host-input-event");
  recordTracker(props.candidateTracker, "candidate-event");

  if (failures.entries.length === 0) {
    recordGenerationProofFailure(failures, {
      domain: "project",
      kind: "snapshot-incomplete",
      path: props.projectRoot,
    });
  }
}

/** {@link selectDeclaredProjectInputKeys} memoized per envelope generation. */
function declaredProjectInputKeys(
  state: TtscEnvelopeDerivation,
  cached: TtscCachedProjectTransform,
): Set<string> | undefined {
  if (state.declaredInputKeysBuilt !== true) {
    state.declaredInputKeys = selectDeclaredProjectInputKeys({
      identities: state.identityContext,
      projectRoot: cached.projectRoot,
      result: cached.result,
      scratchDirectory: cached.scratchDirectory,
    });
    state.declaredInputKeysBuilt = true;
  }
  return state.declaredInputKeys;
}

/**
 * Project-walk keys of every input the envelope declares: the reference graph's
 * edge endpoints, globals, config chain, and resolution candidates, plus the
 * universal host inputs. Returns `undefined` for an envelope with no graph,
 * which declares no input set and therefore keeps whole-walk comparison.
 */
function selectDeclaredProjectInputKeys(props: {
  identities: FilesystemPathIdentityContext;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
}): Set<string> | undefined {
  if (props.result.type === "exception" || props.result.graph === undefined) {
    return undefined;
  }
  const graph = props.result.graph;
  const keys = new Set<string>();
  const add = (entry: unknown): void => {
    if (typeof entry !== "string" || entry.length === 0) return;
    const absolute = path.resolve(props.projectRoot, entry);
    if (isTransformScratchInput(absolute, props.scratchDirectory)) return;
    keys.add(toProjectKey(props.projectRoot, absolute, props.identities));
  };
  for (const [source, targets] of Object.entries(graph.edges ?? {})) {
    add(source);
    if (Array.isArray(targets)) for (const target of targets) add(target);
  }
  if (Array.isArray(graph.globals))
    for (const input of graph.globals) add(input);
  if (Array.isArray(graph.configs))
    for (const input of graph.configs) add(input);
  if (Array.isArray(graph.resolutionInputs))
    for (const input of graph.resolutionInputs) add(input);
  for (const [source, candidates] of Object.entries(graph.candidates ?? {})) {
    add(source);
    if (Array.isArray(candidates)) for (const entry of candidates) add(entry);
  }
  if (Array.isArray(props.result.hostInputs))
    for (const input of props.result.hostInputs) add(input);
  // Plugin-reported dependencies are inputs the graph never sees: a utility
  // plugin's own config file is consulted by the plugin, not by the compiler.
  for (const reported of Object.values(props.result.dependencies ?? {})) {
    if (Array.isArray(reported)) for (const input of reported) add(input);
  }
  return keys;
}

/** Create an empty bounded witness collection for one transform attempt. */
function createGenerationProofFailures(): TtscGenerationProofFailures {
  return { entries: [], omitted: 0, seen: new Set() };
}

/** Retain one unique proof witness without allowing diagnostics to grow freely. */
function recordGenerationProofFailure(
  failures: TtscGenerationProofFailures,
  failure: TtscGenerationProofFailure,
): void {
  const key = JSON.stringify([
    failure.domain,
    failure.kind,
    failure.path,
    failure.detail,
  ]);
  if (failures.seen.has(key)) return;
  if (failures.entries.length < MAX_GENERATION_PROOF_FAILURES) {
    // `seen` follows the same bound as `entries`: retaining every discarded
    // identity would make a bounded diagnostic an unbounded memory sink.
    failures.seen.add(key);
    failures.entries.push(failure);
  } else {
    failures.omitted = Math.min(Number.MAX_SAFE_INTEGER, failures.omitted + 1);
  }
}

/** Fold one bounded witness collection into another. */
function mergeGenerationProofFailures(
  target: TtscGenerationProofFailures,
  source: TtscGenerationProofFailures,
): void {
  for (const failure of source.entries) {
    recordGenerationProofFailure(target, failure);
  }
  target.omitted = Math.min(
    Number.MAX_SAFE_INTEGER,
    target.omitted + source.omitted,
  );
}

/** Hash the declared-input-relevant failure shape without retaining it. */
function projectWalkFailureFingerprint(
  snapshot: {
    complete: boolean;
    directoryComplete: boolean;
    unstableFiles: ReadonlySet<string>;
    walkFailures: readonly TtscProjectWalkFailure[];
  },
  declared: ReadonlySet<string> | undefined,
  projectRoot: string,
  identities: FilesystemPathIdentityContext,
): string {
  const relevantUnstableFiles =
    declared === undefined
      ? [...snapshot.unstableFiles]
      : [...snapshot.unstableFiles].filter((key) => declared.has(key));
  const relevantFailures = snapshot.walkFailures.filter((failure) => {
    if (!failure.kind.startsWith("file-")) return true;
    if (declared === undefined) return true;
    try {
      return declared.has(toProjectKey(projectRoot, failure.path, identities));
    } catch {
      return true;
    }
  });
  return hashText(
    JSON.stringify({
      complete: walkSnapshotComplete(snapshot, declared),
      directoryComplete: snapshot.directoryComplete,
      failures: relevantFailures
        .map((failure) => `${failure.kind}\0${path.resolve(failure.path)}`)
        .sort(),
      unstableFiles: relevantUnstableFiles.sort(),
    }),
  );
}

/** Compact state of one exact out-of-walk input in a failed generation. */
function failedGenerationInputState(
  input: string,
  filesystem: TtscTransformFilesystemOperations,
): string {
  let directory = "not-directory";
  try {
    if (filesystem.stat(input).isDirectory()) {
      directory = hashText(
        filesystem
          .readdir(input)
          .map((entry) =>
            [
              entry.name,
              entry.isDirectory(),
              entry.isFile(),
              entry.isSymbolicLink(),
            ].join(":"),
          )
          .sort()
          .join("\0"),
      );
    }
  } catch {
    directory = "unavailable";
  }
  return hashText(
    JSON.stringify([
      inputMetadataSignature(input, filesystem) ?? "missing",
      hostInputStateHash(input, filesystem) ?? MISSING_INPUT_STATE,
      hostInputRealpath(input, filesystem),
      directory,
    ]),
  );
}

/** Snapshot every input outside the project walk that could change a retry. */
function captureFailedGenerationInputStates(
  cached: TtscCachedProjectTransform,
  failures: TtscGenerationProofFailures,
): ReadonlyMap<string, string> {
  const filesystem = resultFilesystem(cached.result);
  const inputs = new Set(
    (cached.externalInputPaths ?? []).map((input) => path.resolve(input)),
  );
  for (const input of selectPersistentHostInputs({
    filesystem,
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  })) {
    inputs.add(path.resolve(input));
  }
  for (const failure of failures.entries) {
    if (failure.path !== undefined) inputs.add(path.resolve(failure.path));
  }
  return new Map(
    [...inputs]
      .sort()
      .map((input) => [input, failedGenerationInputState(input, filesystem)]),
  );
}

/** Capture source baselines for project and out-of-walk transform outputs. */
function captureTransformSourceHashes(
  cached: TtscCachedProjectTransform,
  currentFile: string,
  currentSourceHash: string,
): Record<string, string> {
  const filesystem = resultFilesystem(cached.result);
  const identities = envelopeDerivation(cached).identityContext;
  const hashes: Record<string, string> = {};
  if (cached.result.type === "success") {
    for (const output of Object.keys(cached.result.typescript)) {
      const file = path.resolve(cached.projectRoot, output);
      const hash = hostInputStateHash(file, filesystem);
      if (hash !== null) hashes[pathIdentityKey(file, identities)] = hash;
    }
  }
  hashes[pathIdentityKey(currentFile, identities)] = currentSourceHash;
  return hashes;
}

/**
 * Whether a terminal proof failure's observed environment actually changed.
 *
 * This is deliberately a confirmation test: inability to re-probe retains the
 * old verdict instead of turning every module request into another compile.
 * Cache lifecycle reset remains the unconditional recovery boundary.
 */
function failedGenerationEnvironmentChanged(
  validation: TtscFailedGenerationValidation,
  props: {
    currentFile: string;
    currentSource: string;
    filesystem: TtscTransformFilesystemOperations;
  },
): boolean {
  try {
    const identities = envelopeDerivation(validation.cached).identityContext;
    const currentSourceHash = hashText(props.currentSource);
    const expectedSourceHash =
      validation.cached.sourceHashes?.[
        pathIdentityKey(props.currentFile, identities)
      ];
    if (
      expectedSourceHash !== undefined &&
      expectedSourceHash !== currentSourceHash
    ) {
      return true;
    }
    const current = collectProjectInputSnapshot(
      validation.cached.projectRoot,
      identities,
      props.filesystem,
      undefined,
      { policy: validation.cached.membershipPolicy },
    );
    if (
      validation.projectWalkComplete !==
        walkSnapshotComplete(current, validation.declaredInputs) ||
      validation.projectWalkFailures !==
        projectWalkFailureFingerprint(
          current,
          validation.declaredInputs,
          validation.cached.projectRoot,
          identities,
        ) ||
      !sameHashes(
        validation.projectInputHashes,
        current.hashes,
        validation.declaredInputs,
      ) ||
      !sameProjectDirectories(
        validation.cached.projectDirectories ?? [],
        current.projectDirectories,
      )
    ) {
      return true;
    }
    for (const [input, recorded] of validation.inputStates) {
      if (failedGenerationInputState(input, props.filesystem) !== recorded) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** Render one input without leaking source content or control characters. */
function formatGenerationFailurePath(
  projectRoot: string,
  input: string,
): string {
  const absolute = path.resolve(input);
  const relative = path.relative(projectRoot, absolute);
  const display =
    relative === ""
      ? "."
      : relative !== ".." &&
          !relative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relative)
        ? relative
        : absolute;
  return JSON.stringify(display.split(path.sep).join("/"));
}

/** Build the terminal error shared by every waiter of an unstable generation. */
function createUnstableGenerationError(
  projectRoot: string,
  attempts: readonly TtscGenerationProofFailures[],
  validation: TtscFailedGenerationValidation,
): TtscUnstableGenerationError {
  const lines = [
    `ttsc: could not capture a reusable transform generation after ${attempts.length} attempts.`,
    `  project: ${projectRoot}`,
  ];
  attempts.forEach((failures, index) => {
    lines.push(`  attempt ${index + 1}:`);
    if (failures.entries.length === 0) {
      lines.push("    - project/generation-proof-incomplete");
    }
    for (const failure of failures.entries) {
      const input =
        failure.path === undefined
          ? ""
          : `: ${formatGenerationFailurePath(projectRoot, failure.path)}`;
      const detail =
        failure.detail === undefined
          ? ""
          : ` (producer: ${JSON.stringify(failure.detail)})`;
      lines.push(`    - ${failure.domain}/${failure.kind}${input}${detail}`);
    }
    if (failures.omitted !== 0) {
      lines.push(
        `    - ... ${failures.omitted} additional witness(es) omitted`,
      );
    }
  });
  lines.push(
    "  Stop writes to the listed inputs before compilation, or fix the producer that omitted or contradicted the listed proof.",
  );
  // The failed snapshot remains useful as immutable retry evidence, but it can
  // never serve a module. Release every live resource before its terminal
  // verdict is retained in the cache.
  disposeCachedTransform(validation.cached);
  return new TtscUnstableGenerationError(lines.join("\n"), validation);
}

function hashText(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function transformProject(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  currentFile: string;
  currentSource: string;
  /**
   * Delivery pass this compile was started for; see
   * {@link TtscCachedProjectTransform.deliveryEpoch}.
   */
  deliveryEpoch?: number;
  filesystem: TtscTransformFilesystemOperations;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  trackProjectMembership: boolean;
  tsconfig: string;
}): Promise<TtscCachedProjectTransform> {
  const attempts: TtscGenerationProofFailures[] = [];
  for (let attempt = 0; attempt < TRANSFORM_GENERATION_ATTEMPTS; attempt += 1) {
    const cached = await captureTransformGeneration(props);
    if (
      cached.configStateComplete !== false &&
      (!props.trackProjectMembership ||
        cached.result.type !== "success" ||
        cached.projectSnapshotComplete === true)
    ) {
      return cached;
    }
    attempts.push(
      TRANSFORM_GENERATION_FAILURES.get(cached.result) ??
        createGenerationProofFailures(),
    );
    if (attempt + 1 === TRANSFORM_GENERATION_ATTEMPTS) {
      const validation = TRANSFORM_FAILED_GENERATION_VALIDATIONS.get(
        cached.result,
      );
      if (validation === undefined) {
        disposeCachedTransform(cached);
        throw new Error(
          "ttsc: failed transform generation has no retry validation baseline",
        );
      }
      throw createUnstableGenerationError(
        path.dirname(props.tsconfig),
        attempts,
        validation,
      );
    }
    disposeCachedTransform(cached);
  }
  throw new Error("ttsc: transform generation retry loop did not terminate");
}

/** Capture one whole-project transform attempt and all of its reuse proofs. */
async function captureTransformGeneration(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  currentFile: string;
  currentSource: string;
  deliveryEpoch?: number;
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
  let clockReferenceDirectory: string | undefined;
  let retainClockReferenceDirectory = false;
  let tracker: TtscProjectMutationTracker | undefined;
  let retainTracker = false;
  let hostInputTracker: TtscProjectMutationTracker | undefined;
  let candidateTracker: TtscProjectMutationTracker | undefined;
  let retainHostInputTracker = false;
  let retainCandidateTracker = false;
  let captured: TtscCachedProjectTransform | undefined;
  try {
    if (props.trackProjectMembership) {
      try {
        clockReferenceDirectory = createTransformScratchDirectory(
          projectRoot,
          props.filesystem,
        );
      } catch {
        // A retained probe is an optimization. The live compiler scratch can
        // still authorize capture, and later validations will compare bytes.
      }
    }
    const materializesConfig =
      Object.keys(props.compilerOptions).length !== 0 ||
      Object.keys(props.aliasPaths).length !== 0;
    const tsconfigState = readTransformTsconfigState(
      props.tsconfig,
      materializesConfig,
    );
    const configured = createTransformTsconfig(
      props,
      scratchDirectory,
      tsconfigState,
    );
    const temporaryTsconfig =
      configured.path === props.tsconfig ? undefined : configured.path;
    const compilerEnvironment = transformScratchEnvironment(scratchDirectory);
    if (temporaryTsconfig === undefined) {
      delete compilerEnvironment[TTSC_SEMANTIC_CONFIG_PATH];
    } else {
      compilerEnvironment[TTSC_SEMANTIC_CONFIG_PATH] = props.tsconfig;
    }
    const identities = createHostPathIdentityContext(props.filesystem);
    // Read from the project's own tsconfig rather than the generated one: a
    // relative `outDir` is anchored at the config that declares it, and the
    // generated config lives in a system temp directory. The caller's
    // compiler-options overlay still wins, since it wins for the compile too.
    const membershipPolicy = mergeMembershipPolicyOverlay(
      tsconfigState.membershipPolicy,
      props.compilerOptions,
      projectRoot,
    );
    const before = collectProjectInputSnapshot(
      projectRoot,
      identities,
      props.filesystem,
      undefined,
      { policy: membershipPolicy },
    );
    tracker = props.trackProjectMembership
      ? await createProjectMutationTracker(
          before.projectDirectories,
          props.filesystem,
          membershipPolicy,
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
        env: compilerEnvironment,
      }).transform(),
    );
    TRANSFORM_RESULT_FILESYSTEM.set(result, props.filesystem);
    const configStable =
      tsconfigState.signature === undefined ||
      tsconfigState.signature ===
        readTransformTsconfigState(props.tsconfig, true).signature;
    // Mint the generation's clock reference after the compile and before any
    // signature-recording read below, so every input written before the
    // compile sits in a provably finished tick when its signature is captured.
    refreshFilesystemClockReference(
      clockReferenceDirectory ?? scratchDirectory,
      props.filesystem,
    );
    const persistentHostInputs = selectPersistentHostInputs({
      filesystem: props.filesystem,
      projectRoot,
      result,
      scratchDirectory,
      temporaryTsconfig,
    });
    // The generation's absent resolution candidates, which get a watcher of
    // their own below; watching one is what lets a delivery stop probing it
    // (samchon/ttsc#1261). The validation manifest stays built from the
    // universal inputs alone, so nothing else about a candidate changes.
    //
    // Derived only where a tracker could carry it: a build-scoped adapter opens
    // no watcher, so probing every candidate's existence here would be work
    // whose answer nothing can read.
    const notifiableAbsence = props.trackProjectMembership
      ? selectNotifiableAbsentInputs({
          filesystem: props.filesystem,
          projectRoot,
          result,
          scratchDirectory,
          temporaryTsconfig,
        })
      : { candidates: [], watched: [] };
    hostInputTracker = props.trackProjectMembership
      ? await createHostInputMutationTracker(
          persistentHostInputs,
          props.filesystem,
          // A universal input never reaches the per-input loop that consults a
          // coverage claim: an absent one is proven by its directory listing
          // instead, which re-resolves the spelling every delivery.
          new Set(),
        )
      : undefined;
    // The candidates and the directories carrying them get their own tracker,
    // listening for renames alone. Every event that can make one of these
    // paths appear is a rename — the file itself, or a component of the path
    // being created, replaced, or retargeted — so nothing is given up, while a
    // backend that reports a write below a directory as a change to that
    // directory's entry (Windows does) would otherwise replace the generation
    // every time a bundler wrote inside `node_modules`.
    candidateTracker =
      notifiableAbsence.watched.length !== 0
        ? await createHostInputMutationTracker(
            notifiableAbsence.watched,
            props.filesystem,
            new Set(notifiableAbsence.candidates),
            "rename",
          )
        : undefined;
    const externalInputPaths = selectExternalInputPaths({
      filesystem: props.filesystem,
      membershipPolicy,
      projectRoot,
      result,
      scratchDirectory,
      temporaryTsconfig,
    });
    const inputSnapshot = collectProjectInputSnapshot(
      projectRoot,
      identities,
      props.filesystem,
      undefined,
      { policy: membershipPolicy },
    );
    // Whether the recorded snapshot describes one coherent state of the
    // project. A membership event during the compile taints it exactly like an
    // unstable walk pair; whether notifications can be *opened* is a separate
    // fact, tracked below, because a generation with no watcher is still
    // provable from its own recorded state.
    const declaredInputs = selectDeclaredProjectInputKeys({
      identities,
      projectRoot,
      result,
      scratchDirectory,
    });
    const walkStable =
      configStable &&
      walkSnapshotComplete(before, declaredInputs) &&
      walkSnapshotComplete(inputSnapshot, declaredInputs) &&
      sameHashes(before.hashes, inputSnapshot.hashes, declaredInputs) &&
      sameHashes(
        before.fileSignatures,
        inputSnapshot.fileSignatures,
        declaredInputs,
      ) &&
      sameProjectDirectories(
        before.projectDirectories,
        inputSnapshot.projectDirectories,
      ) &&
      tracker?.membershipChanged !== true &&
      hostInputTracker?.membershipChanged !== true &&
      candidateTracker?.membershipChanged !== true;
    const notificationsAvailable =
      tracker?.failed !== true &&
      hostInputTracker?.failed !== true &&
      candidateTracker?.failed !== true;
    // Overlay the in-memory source only after proving the two on-disk snapshots
    // stable; an unsaved editor buffer must not look like a compile-time race.
    const currentFileKey = toProjectKey(
      projectRoot,
      props.currentFile,
      identities,
    );
    const currentSourceHash = hashText(props.currentSource);
    const projectInputHashes = { ...inputSnapshot.hashes };
    if (
      Object.prototype.hasOwnProperty.call(inputSnapshot.hashes, currentFileKey)
    ) {
      inputSnapshot.hashes[currentFileKey] = currentSourceHash;
      // That overlay makes this one key the only recorded hash a disk signature
      // cannot stand for: the bytes it names came from the bundler, not the file.
      delete inputSnapshot.provenSignatures[currentFileKey];
    }
    const cached: TtscCachedProjectTransform = {
      // The pass this compile was started for. Its snapshot describes the
      // project as of this compile, so it is settled for this pass and any
      // later pass must re-prove it.
      ...(props.deliveryEpoch === undefined
        ? {}
        : { deliveryEpoch: props.deliveryEpoch }),
      // Capture the out-of-walk input hashes while the generation is fresh so
      // cache validation can re-check them; computed before dispose so the
      // scratch-tree exclusion is the only reason its disposed artifacts never
      // key the persistent generation.
      externalInputHashes: {},
      externalInputRealpaths: {},
      externalInputPaths,
      configStateComplete: configStable,
      inputHashes: inputSnapshot.hashes,
      inputSignatures: inputSnapshot.provenSignatures,
      membershipPolicy,
      projectDirectories: inputSnapshot.projectDirectories,
      tsconfig: props.tsconfig,
      projectSnapshotComplete: false,
      projectRoot,
      result,
      scratchDirectory,
      servedFiles: new Set(),
      // Remember the generated temp-dir tsconfig (disposed below) so watch
      // derivation can drop it from the envelope's config chain; a registered
      // but deleted file would invalidate every persistent-cache snapshot.
      ...(temporaryTsconfig === undefined ? {} : { temporaryTsconfig }),
    };
    cached.sourceHashes = captureTransformSourceHashes(
      cached,
      props.currentFile,
      currentSourceHash,
    );
    const externalInputSnapshot = captureExternalInputSnapshot(
      cached,
      externalInputPaths,
    );
    cached.externalInputHashes = externalInputSnapshot.hashes;
    cached.externalInputObservations = externalInputSnapshot.observations;
    cached.externalInputRealpaths = externalInputSnapshot.realpaths;
    cached.externalInputSignatures = externalInputSnapshot.signatures;
    // Evaluate every half, rather than short-circuiting, so a generation that
    // cannot be reused can say which evidence it lacked. The extra work runs
    // only on the failing path, where the alternative is recompiling the whole
    // project for every remaining module.
    const failures = createGenerationProofFailures();
    if (!configStable) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind: "config-state-changed",
        path: props.tsconfig,
      });
    }
    if (!walkStable) {
      recordProjectSnapshotFailures(failures, {
        before,
        candidateTracker,
        declared: declaredInputs,
        hostInputTracker,
        identities,
        projectRoot,
        snapshot: inputSnapshot,
        tracker,
      });
    }
    const graphFailures = compilerGraphInputProofFailures(cached);
    mergeGenerationProofFailures(failures, graphFailures);
    mergeGenerationProofFailures(failures, externalInputSnapshot.failures);
    const universalInputCapture = captureUniversalHostInputValidation(
      cached,
      props.currentFile,
    );
    mergeGenerationProofFailures(failures, universalInputCapture.failures);
    const graphProofs =
      graphFailures.entries.length === 0 && graphFailures.omitted === 0;
    const universalInputs = universalInputCapture.validation !== undefined;
    const stableProjectSnapshot =
      walkStable &&
      graphProofs &&
      externalInputSnapshot.complete &&
      universalInputs;
    if (!stableProjectSnapshot) {
      TRANSFORM_GENERATION_FAILURES.set(result, failures);
      TRANSFORM_FAILED_GENERATION_VALIDATIONS.set(result, {
        cached,
        declaredInputs,
        inputStates: captureFailedGenerationInputStates(cached, failures),
        projectInputHashes,
        projectWalkComplete: walkSnapshotComplete(
          inputSnapshot,
          declaredInputs,
        ),
        projectWalkFailures: projectWalkFailureFingerprint(
          inputSnapshot,
          declaredInputs,
          projectRoot,
          identities,
        ),
      });
    }
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
    if (notifying && candidateTracker !== undefined) {
      cached.candidateMutationTracker = candidateTracker;
    }
    // Every tracker the generation published is retained, and every tracker it
    // did not is closed below. Naming only two of the three would close a
    // published candidate tracker the moment either of the others was absent,
    // and that is the one tracker whose silence is read as evidence.
    retainTracker = notifying && tracker !== undefined;
    retainHostInputTracker = notifying && hostInputTracker !== undefined;
    retainCandidateTracker = notifying && candidateTracker !== undefined;
    if (clockReferenceDirectory !== undefined) {
      retainClockReferenceDirectory = true;
    }
    captured = cached;
  } finally {
    let cleanupFailed = false;
    let cleanupFailure: unknown;
    try {
      try {
        if (!retainTracker && tracker !== undefined) {
          tracker.close();
        }
      } finally {
        try {
          if (!retainHostInputTracker && hostInputTracker !== undefined) {
            hostInputTracker.close();
          }
        } finally {
          try {
            if (!retainCandidateTracker && candidateTracker !== undefined) {
              candidateTracker.close();
            }
          } finally {
            try {
              fs.rmSync(scratchDirectory, { force: true, recursive: true });
            } finally {
              if (
                !retainClockReferenceDirectory &&
                clockReferenceDirectory !== undefined
              ) {
                disposeFilesystemClockReference(clockReferenceDirectory);
              }
            }
          }
        }
      }
    } catch (error) {
      cleanupFailed = true;
      cleanupFailure = error;
    }
    if (cleanupFailed) {
      // The generation never leaves this function when local cleanup fails.
      // Close everything that was waiting to transfer, without letting a
      // secondary teardown error replace the first failure.
      for (const retained of [
        retainTracker ? tracker : undefined,
        retainHostInputTracker ? hostInputTracker : undefined,
        retainCandidateTracker ? candidateTracker : undefined,
      ]) {
        try {
          retained?.close();
        } catch {
          // Continue releasing the other generation-owned resources.
        }
      }
      if (
        retainClockReferenceDirectory &&
        clockReferenceDirectory !== undefined
      ) {
        disposeFilesystemClockReference(clockReferenceDirectory);
      }
      throw cleanupFailure;
    }
  }
  if (captured === undefined) {
    throw new Error("ttsc: transform generation capture produced no result");
  }
  if (clockReferenceDirectory !== undefined) {
    TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.set(
      captured,
      clockReferenceDirectory,
    );
  }
  return captured;
}

/** Exclude disposed transform scratch from live host-input tracking. */
function selectPersistentHostInputs(props: {
  filesystem: TtscTransformFilesystemOperations;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
  temporaryTsconfig?: string;
}): string[] {
  if (props.result.type === "exception") return [];
  const inputs = selectListedFiles(props.projectRoot, props.result.hostInputs);
  if (
    props.scratchDirectory === undefined &&
    props.temporaryTsconfig === undefined
  )
    return inputs;
  const identities = createHostPathIdentityContext(props.filesystem);
  const temporary =
    props.temporaryTsconfig === undefined
      ? undefined
      : pathIdentityKey(props.temporaryTsconfig, identities);
  return inputs.filter((input) => {
    if (isTransformScratchInput(input, props.scratchDirectory)) return false;
    return pathIdentityKey(input, identities) !== temporary;
  });
}

interface ITransformTsconfigState {
  effectivePaths: Record<string, string[]>;
  membershipPolicy: ITtscProjectMembershipPolicy;
  signature?: string;
  templateCompilerOptions: Record<string, unknown>;
  templateFileSpecs: Record<string, unknown>;
}

/** Read every wrapper-dependent view and bind it to one config-chain state. */
function readTransformTsconfigState(
  tsconfig: string,
  materializesConfig: boolean,
): ITransformTsconfigState {
  const membershipPolicy = readProjectMembershipPolicy(tsconfig);
  if (!materializesConfig) {
    return {
      effectivePaths: {},
      membershipPolicy,
      templateCompilerOptions: {},
      templateFileSpecs: {},
    };
  }
  const effectivePaths = readEffectiveTsconfigPaths(tsconfig);
  const templateCompilerOptions =
    readEffectiveTsconfigTemplateCompilerOptions(tsconfig);
  const templateFileSpecs = readEffectiveTsconfigTemplateFileSpecs(tsconfig);
  const sources = readTsconfigSourceSnapshot(tsconfig);
  return {
    effectivePaths,
    membershipPolicy,
    signature: hashText(
      JSON.stringify({
        effectivePaths,
        membershipPolicy,
        sources,
        templateCompilerOptions,
        templateFileSpecs,
      }),
    ),
    templateCompilerOptions,
    templateFileSpecs,
  };
}

function createTransformTsconfig(
  props: {
    aliasPaths: Record<string, string[]>;
    compilerOptions: Record<string, unknown>;
    tsconfig: string;
  },
  scratchDirectory: string,
  state: ITransformTsconfigState,
): { path: string } {
  const overlay = normalizeCompilerOptionsForGeneratedTsconfig(
    {
      ...props.compilerOptions,
      ...createAliasCompilerOptions(props, state.effectivePaths),
    },
    path.dirname(props.tsconfig),
  );
  if (Object.keys(overlay).length === 0) {
    return { path: props.tsconfig };
  }

  // A `${configDir}` value survives every `extends` hop and binds only at the
  // final consumer. The scratch wrapper would therefore move it out of the
  // project even for an unrelated overlay. Re-state only those inherited
  // values as absolute paths so the wrapper remains semantically transparent.
  const compilerOptions = {
    ...state.templateCompilerOptions,
    ...overlay,
  };
  const file = path.join(scratchDirectory, "tsconfig.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        extends: normalizePath(props.tsconfig),
        ...state.templateFileSpecs,
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

/** Whether an input is owned by the disposable transform scratch tree. */
function isTransformScratchInput(
  input: string,
  scratchDirectory: string | undefined,
): boolean {
  return (
    scratchDirectory !== undefined &&
    pathIsWithin(path.resolve(input), path.resolve(scratchDirectory))
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
  for (const key of CONFIG_DIR_TEMPLATE_SCALAR_OPTIONS) {
    if (typeof output[key] === "string") {
      output[key] = resolveConfigDirTemplatePath(tsconfigDir, output[key]);
    }
  }
  // Array path fields: resolve each element individually.
  for (const key of CONFIG_DIR_TEMPLATE_LIST_OPTIONS) {
    if (Array.isArray(output[key])) {
      output[key] = output[key].map((entry) =>
        typeof entry === "string"
          ? resolveConfigDirTemplatePath(tsconfigDir, entry)
          : entry,
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
function createAliasCompilerOptions(
  props: {
    aliasPaths: Record<string, string[]>;
    compilerOptions: Record<string, unknown>;
    tsconfig: string;
  },
  effectivePaths: Record<string, string[]>,
): Record<string, unknown> {
  if (Object.keys(props.aliasPaths).length === 0) {
    return {};
  }
  return {
    paths: {
      ...effectivePaths,
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
    if (typeof alias.find !== "string") {
      // Vite's array form accepts a `RegExp` find, and `{ find: /^~/ }` is a
      // common way to spell a prefix alias. A tsconfig `paths` map has no
      // regular-expression form, so there is nothing to translate it into
      // (samchon/ttsc#1315). Reducing the simple prefix cases to a string is
      // possible in principle and deliberately not done: telling `/^~/` from
      // `/^~(?=\/)/` or `/^@app/` — which matches `@apple` too — means
      // implementing enough of a regular-expression engine that a wrong
      // reduction becomes likely, and a mistranslated alias resolves imports to
      // the wrong file silently, which is worse than not forwarding it.
      //
      // Not reported, unlike the wildcard below, and that asymmetry is the
      // whole point: Vite merges two `RegExp` aliases of its own into every
      // resolved config, `/^\/?@vite\/env/` and `/^\/?@vite\/client/`. Measured
      // on a bare project with no user aliases at all, `resolve.alias` has
      // exactly those two entries under both `serve` and `build`, so a report
      // on this form would fire twice for every Vite user in every build, name
      // aliases they never wrote, and say nothing about their configuration.
      // A diagnostic that cannot distinguish the user's input from the host's
      // is noise, and noise is what teaches people to stop reading the channel
      // the out-of-program report depends on. The documentation carries this
      // form instead, in both README and guide.
      continue;
    }
    if (alias.find.length === 0) {
      continue;
    }
    if (alias.find.includes("*")) {
      // A `paths` key reads `*` as its own wildcard, so forwarding a `find`
      // that already contains one cannot preserve the caller's meaning.
      reportUntranslatableAlias(
        JSON.stringify(alias.find),
        'a "paths" key already reads "*" as its own wildcard',
      );
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

/**
 * Alias descriptions already reported in this process.
 *
 * The message is about configuration rather than about a module:
 * `resolve.alias` is resolved once and then consulted on every delivery, so
 * reporting per delivery would repeat one statement about the config for every
 * file in the bundle. Keyed by the description, so a Vite dev server that
 * reloads its config reports again only when the alias itself changed.
 */
const REPORTED_UNTRANSLATABLE_ALIASES = new Set<string>();

/**
 * Tell the user once that an alias they declared is not reaching the compile.
 *
 * A dropped alias is not silent in its consequence — the compile resolves
 * through the tsconfig's own `paths`, and a module that resolves for the
 * bundler but not for the compiler surfaces as the out-of-program report
 * (samchon/ttsc#1308) — but that report names the module, not the alias, so the
 * user cannot learn from it that a configuration they wrote was ignored.
 *
 * Only the wildcard form reaches here. Every entry it names was written by the
 * user, because nothing injects one; the `RegExp` form is left to the
 * documentation precisely because Vite does inject those, and
 * {@link createAliasPaths} carries that measurement.
 */
function reportUntranslatableAlias(description: string, reason: string): void {
  if (REPORTED_UNTRANSLATABLE_ALIASES.has(description)) {
    return;
  }
  REPORTED_UNTRANSLATABLE_ALIASES.add(description);
  process.stderr.write(
    `ttsc: the Vite alias ${description} was not forwarded to the compile, because ${reason}. Declare it in your tsconfig's "paths" if ttsc must resolve through it.\n`,
  );
}

/**
 * Collect the host's declared aliases without deciding which of them can be
 * expressed as `paths`.
 *
 * That decision belongs to {@link createAliasPaths} alone. It used to be split:
 * this function's type guard required a string `find` and dropped Vite's
 * `RegExp` form before `createAliasPaths` ever saw it, which left
 * `createAliasPaths`'s own non-string branch unreachable and put the drop
 * somewhere nothing could report it (samchon/ttsc#1315).
 */
function normalizeAliases(aliases: unknown): TtscDeclaredAlias[] {
  if (Array.isArray(aliases)) {
    return aliases.filter(isDeclaredAlias);
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

function isDeclaredAlias(value: unknown): value is TtscDeclaredAlias {
  return (
    typeof value === "object" &&
    value !== null &&
    "find" in value &&
    "replacement" in value &&
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
  tsconfig: string;
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
  throw new TtscMissingProgramOutputError(props.file, props.tsconfig);
}

/**
 * Tell the user once that a module was left untransformed, and why.
 *
 * The condition is ordinary and the build continues, but it must never be
 * silent: a file the program does not contain keeps whatever plugin syntax it
 * carries, so a typia `assert<T>()` in it becomes a runtime failure rather than
 * a build failure. One line per file per generation per pass, on the channel
 * the generation's other non-fatal diagnostics already use, so a bundle that
 * reaches many such files does not repeat itself per delivery.
 */
function reportMissingProgramOutput(
  cached: TtscCachedProjectTransform,
  error: TtscMissingProgramOutputError,
  epoch: number | undefined,
): void {
  const reported = (cached.missingOutputReported ??= new Set<string>());
  if (cached.missingOutputEpoch !== epoch) {
    cached.missingOutputEpoch = epoch;
    reported.clear();
  }
  if (reported.has(error.file)) {
    return;
  }
  reported.add(error.file);
  process.stderr.write(`${error.message}
`);
}

/**
 * Forward non-fatal plugin diagnostics to stderr, once per generation per pass.
 *
 * A `success` result may still carry warnings or informational messages from
 * plugins — `@ttsc/lint` reports every rule below error severity this way.
 * These are surfaced via stderr rather than throwing so the build continues.
 * Failures and exceptions are handled by the caller.
 *
 * They describe one compile of one program, so writing them per delivery
 * printed the same warning once per module and scaled the noise with exactly
 * the reuse the cache exists to provide (samchon/ttsc#1304). A pass that reuses
 * a retained generation still surfaces them once, because a build's warnings
 * are part of what that build reports; a host with no pass boundary surfaces
 * them once per generation, which is the same rule with one pass.
 */
function reportSuccessDiagnostics(
  cached: TtscCachedProjectTransform,
  epoch: number | undefined,
): void {
  const result = cached.result;
  if (result.type !== "success" || result.diagnostics === undefined) {
    return;
  }
  if (
    cached.diagnosticsReported === true &&
    cached.diagnosticsEpoch === epoch
  ) {
    return;
  }
  cached.diagnosticsReported = true;
  cached.diagnosticsEpoch = epoch;
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
        stripTerminalEscapes(diag.messageText),
      ]
        .filter((part) => part !== undefined && part !== "")
        .join(": "),
    )
    .join("\n");
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return stripTerminalEscapes(error.message);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return stripTerminalEscapes(error.message);
  }
  return stripTerminalEscapes(String(error));
}

/**
 * Remove terminal colour and cursor sequences from text the adapter surfaces.
 *
 * An ordinary type error reaches the adapter as an `"exception"` envelope whose
 * `error` is the host's own rendered output, colour and all, and the envelope
 * carries no structured diagnostics to format instead. What the adapter hands
 * back is not going to a terminal: it becomes the `Error` a bundler reports, so
 * it lands in a Vite overlay, a webpack error report or a CI annotation, where
 * the escapes render as literal noise around the file and line the reader needs
 * (samchon/ttsc#1312).
 *
 * The colour originates in the host's rendering rather than in anything this
 * adapter configures, so this is the adapter-side repair, applied to every
 * message it surfaces rather than to one call site.
 */
function stripTerminalEscapes(text: string): string {
  // Built from a char code so no control byte lives in this source file, and
  // written with `[[]` (a class holding one literal bracket) so the pattern
  // needs no backslash escapes to survive the string it is assembled from.
  const escape = String.fromCharCode(27);
  const controlSequence = new RegExp(escape + "[[][0-9;?]*[ -/]*[@-~]", "g");
  return text.replace(controlSequence, "");
}

/**
 * Locate the tsconfig that should govern the transform for `file`.
 *
 * If `tsconfig` is supplied it is returned as-is (absolute) or resolved from
 * `process.cwd()` (relative). Otherwise the function walks ancestor directories
 * starting at `file`'s directory, returning the first `tsconfig.json` proven to
 * be a file. Falls back to `<cwd>/tsconfig.json` when no ancestor contains one;
 * the compiler will error if that file does not exist, which is the correct
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

  const discovered = findNearestProjectTsconfig(path.dirname(file), filesystem);
  if (discovered !== undefined) {
    return discovered;
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
