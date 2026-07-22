/**
 * Project fingerprint and reference-graph snapshot for `@ttsc/metro`.
 *
 * Metro's transform cache keys each file on its own content plus one static
 * transformer key computed once per run (`getCacheKey`, called on the main
 * process at `Transformer` construction). A ttsc transform's output can depend
 * on inputs Metro never keys: other project sources reached through type-only
 * edges, `node_modules` declarations, monorepo sibling sources, and the
 * tsconfig `extends` ancestry. This module folds all of them into the static
 * key so the cache key incorporates every input that can influence a
 * transform's output:
 *
 * - **Project walk.** Every input file under the fingerprint roots (Metro's
 *   `projectRoot` plus the resolved tsconfig's directory when it lies outside),
 *   hashed with the exact walk universe the `@ttsc/unplugin` transform core
 *   validates its own cache against.
 * - **Recorded out-of-walk inputs.** The transform core cannot walk files outside
 *   the roots or under ignored directories, but the host-owned reference graph
 *   (samchon/ttsc#718) reports them per transform. Workers record them into a
 *   snapshot under `node_modules/.cache/ttsc-metro`; the next run's
 *   `getCacheKey` re-hashes the recorded set.
 *
 * Snapshot layout: one main file carrying a random epoch id plus per-worker
 * files with unique names, so concurrent workers never race a shared write.
 * `withTtsc` (the single config process, before workers exist) compacts worker
 * files into the main file. Readers take the union of every file, reading the
 * worker files strictly before the main file: the compactor renames the merged
 * main into place strictly before deleting a worker file, so a worker file that
 * disappears mid-read is always already merged into the main the reader loads
 * afterwards.
 *
 * Sound degradations, by design:
 *
 * - No readable snapshot (first run, wiped cache dir, unwritable filesystem)
 *   folds a random nonce: that run shares no cache entries with any other run.
 * - A failed snapshot write persists the pending observation beside the snapshot
 *   directory. While any such recovery document exists, readers fold a nonce;
 *   successful compaction merges it and mints a fresh epoch.
 * - A recreated snapshot carries a fresh epoch id, so it can never alias a key
 *   from an older epoch whose recorded set is unknown.
 * - A plugin-declared volatile output (non-file inputs; unrepresentable in any
 *   file fingerprint) marks the snapshot volatile, which also folds a nonce
 *   until a later run records the volatile declaration gone.
 * - A recorded input that disappears hashes as a stable `missing` marker, so
 *   deletion and reappearance both move the key.
 */
import {
  collectExternalInputHashes,
  collectProjectInputHashes,
  isProjectWalkPath,
} from "@ttsc/unplugin/api";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Bumped when the snapshot JSON shape changes; mismatches read as corrupt. */
const SNAPSHOT_VERSION = 1;

/** Snapshot directory segments under the fingerprint base directory. */
const SNAPSHOT_DIRECTORY = ["node_modules", ".cache", "ttsc-metro"];

/** Recovery-document prefix in the parent cache directory. */
const UNHEALTHY_SNAPSHOT_PREFIX = "ttsc-metro.unhealthy-";

/** Main snapshot file name (epoch id + compacted recorded inputs). */
const MAIN_SNAPSHOT = "graph-inputs.json";

/** Worker snapshot file prefix; each worker appends a unique suffix. */
const WORKER_SNAPSHOT_PREFIX = "graph-inputs.worker-";

/** Prefix used after a compactor atomically claims an immutable worker file. */
const CLAIMED_WORKER_SNAPSHOT_PREFIX = "graph-inputs.worker-claimed-";

/** Union of the snapshot state readable on disk. */
interface SnapshotState {
  /** Random epoch id minted when the main snapshot was created. */
  id: string;
  /** Absolute paths of every recorded out-of-walk input. */
  files: string[];
  /** Whether any recorded transform declared volatile output. */
  volatile: boolean;
}

/** Serialized shape of the main and worker snapshot files. */
interface SnapshotDocument {
  files: string[];
  id?: string;
  version: number;
  volatile: boolean;
}

/** Snapshot documents discovered during one directory scan. */
interface SnapshotDocuments {
  corruptPaths: string[];
  entries: SnapshotDocument[];
  paths: string[];
  readable: boolean;
}

/** Bases whose latest observation is not yet durable in the main snapshot. */
const unhealthySnapshots = new Set<string>();

/**
 * Resolve the base directory both fingerprint sides agree on: Metro's
 * `projectRoot` when known (`withTtsc` reads it from the config, `getCacheKey`
 * from Metro's cache-key options, the transformer from each file's transform
 * options — all the same value in a real Metro run), else the working directory
 * Metro was launched from.
 */
export function resolveFingerprintBase(
  projectRoot: string | undefined,
): string {
  return path.resolve(
    typeof projectRoot === "string" && projectRoot.length !== 0
      ? projectRoot
      : process.cwd(),
  );
}

/**
 * The directories whose walk universes the fingerprint hashes: the base
 * directory, plus the resolved tsconfig's directory when the tsconfig is not
 * already inside the base walk (an explicit out-of-root `project`, or a
 * monorepo-root tsconfig discovered above the app). Matching the transform
 * core's own validation universe keeps the invariant simple: everything the
 * core treats as an input is fingerprinted, either by a walk here or by the
 * recorded out-of-walk snapshot.
 */
export function fingerprintRoots(
  base: string,
  explicitProject: string | undefined,
): string[] {
  const tsconfig = resolveProjectTsconfig(base, explicitProject);
  if (isProjectWalkPath(base, tsconfig)) {
    return [base];
  }
  return [base, path.dirname(tsconfig)];
}

/**
 * Locate the tsconfig governing the project, mirroring the transform core's
 * discovery: an explicit `project` resolves against the working directory;
 * otherwise ancestor directories starting at `base` are searched for a
 * `tsconfig.json`, falling back to `<base>/tsconfig.json`.
 */
function resolveProjectTsconfig(
  base: string,
  explicitProject: string | undefined,
): string {
  if (explicitProject !== undefined && explicitProject.length !== 0) {
    return path.isAbsolute(explicitProject)
      ? explicitProject
      : path.resolve(process.cwd(), explicitProject);
  }
  let current = base;
  while (true) {
    const candidate = path.join(current, "tsconfig.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return path.resolve(base, "tsconfig.json");
}

/**
 * Compute the fingerprint `getCacheKey` folds into Metro's static transformer
 * key. Never throws: any failure degrades to a nonce, which soundly disables
 * cross-run cache reuse for this run instead of serving stale output.
 */
export function computeProjectFingerprint(props: {
  explicitProject?: string;
  projectRoot?: string;
}): string {
  try {
    const base = resolveFingerprintBase(props.projectRoot);
    const hash = createHash("sha256");
    for (const root of fingerprintRoots(base, props.explicitProject)) {
      hash.update(stableStringify(collectProjectInputHashes(root)));
    }
    const snapshot = readSnapshotState(base);
    if (snapshot === undefined || snapshot.volatile) {
      hash.update(nonce());
    } else {
      hash.update(`snapshot:${snapshot.id}`);
      hash.update(stableStringify(collectExternalInputHashes(snapshot.files)));
    }
    return hash.digest("hex");
  } catch {
    return nonce();
  }
}

/**
 * A value no other run can reproduce. Folding it means this run's cache entries
 * are written but never reused by later runs, and this run reuses nothing from
 * earlier ones — the sound fallback whenever the recorded out-of-walk input set
 * is unknown or unrepresentable.
 */
function nonce(): string {
  return `nonce:${randomBytes(32).toString("hex")}`;
}

/**
 * Prepare the snapshot for a new run. Called from `withTtsc` in the single
 * Metro config process, before any worker exists: creates the main snapshot
 * (fresh epoch id) when missing or corrupt, compacts leftover worker files into
 * it, and sweeps unparseable worker files plus crash-leftover temp files. An
 * unparseable worker file's recordings are unrecoverable, so its removal mints
 * a fresh epoch id — every key that might have depended on the lost recordings
 * is soundly orphaned, and later runs stabilize instead of degrading to a nonce
 * forever. A failed rewrite leaves a recovery document outside the snapshot
 * directory so `getCacheKey` degrades to a nonce until a later compaction
 * succeeds. If an older readable main exists and neither location is writable,
 * preparation throws instead of authorizing stale reuse.
 */
export function prepareSnapshot(projectRoot: string | undefined): void {
  const base = resolveFingerprintBase(projectRoot);
  let hadReadableMain = false;
  let pending: SnapshotDocument = {
    files: [],
    version: SNAPSHOT_VERSION,
    volatile: false,
  };
  try {
    // A nonexistent base can never be a working Metro setup (Metro verifies
    // the project root exists), so preparing a snapshot there would only
    // materialize directory trees at arbitrary paths.
    if (!fs.existsSync(base)) {
      return;
    }
    const directory = snapshotDirectory(base);
    fs.mkdirSync(directory, { recursive: true });
    // Read the worker files strictly before the main file (see the module doc
    // comment): a concurrent compactor deletes a worker file only after the
    // merged main is renamed into place, so whatever this enumeration misses
    // is already inside the main read below.
    claimWorkerFiles(directory);
    const recovery = readUnhealthySnapshots(base);
    const workers = readWorkerFiles(directory);
    if (!recovery.readable || !workers.readable) {
      throw new Error("Unable to enumerate Metro snapshot state.");
    }
    const main = readMainDocument(directory);
    hadReadableMain = main !== undefined && typeof main.id === "string";
    const files = new Set(main?.files ?? []);
    const observations = [...recovery.entries, ...workers.entries];
    const volatile =
      observations.length === 0
        ? (main?.volatile ?? false)
        : // Worker files carry the previous run's fresh observations, so they
          // own the volatile verdict: a removed volatile declaration must be
          // able to clear the sticky flag.
          observations.some((entry) => entry.volatile);
    for (const entry of observations) {
      for (const file of entry.files) {
        files.add(file);
      }
    }
    const recovering =
      unhealthySnapshots.has(base) ||
      recovery.paths.length !== 0 ||
      recovery.corruptPaths.length !== 0;
    pending = {
      files: [...files].sort(),
      id:
        !recovering && workers.corruptPaths.length === 0
          ? (main?.id ?? randomBytes(16).toString("hex"))
          : randomBytes(16).toString("hex"),
      version: SNAPSHOT_VERSION,
      volatile,
    };
    writeSnapshotDocument(path.join(directory, MAIN_SNAPSHOT), pending);
    for (const file of [
      ...workers.paths.filter(isClaimedWorkerSnapshot),
      ...workers.corruptPaths.filter(isClaimedWorkerSnapshot),
      ...recovery.paths,
      ...recovery.corruptPaths,
      ...listTemporaryFiles(directory),
    ]) {
      try {
        fs.rmSync(file, { force: true });
      } catch {
        // A locked worker file stays behind; readers union it, so nothing is
        // lost, and the next compaction retries.
      }
    }
    const remainingRecovery = readUnhealthySnapshots(base);
    if (
      remainingRecovery.readable &&
      remainingRecovery.paths.length === 0 &&
      remainingRecovery.corruptPaths.length === 0
    ) {
      unhealthySnapshots.delete(base);
    }
  } catch (snapshotError) {
    try {
      persistUnhealthySnapshot(base, pending);
    } catch (recoveryError) {
      if (hadReadableMain || hasReadableMainSnapshot(base)) {
        throw new AggregateError(
          [snapshotError, recoveryError],
          "Unable to persist Metro snapshot state or its recovery record.",
        );
      }
    }
  }
}

/**
 * Crash-leftover temp files from the atomic writer, swept at compaction. Only
 * files older than a day qualify: a young temp file may belong to a live writer
 * in a concurrently running Metro instance, and deleting it mid-write would
 * silently drop that writer's recordings.
 */
function listTemporaryFiles(directory: string): string[] {
  const horizon = Date.now() - 24 * 60 * 60 * 1000;
  try {
    return fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(".tmp"))
      .map((name) => path.join(directory, name))
      .filter((file) => {
        try {
          return fs.statSync(file).mtimeMs < horizon;
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

/**
 * Read the unioned snapshot state, or `undefined` when the main snapshot is
 * missing or any snapshot file is corrupt (a torn or foreign write means the
 * recorded set cannot be trusted, so the caller degrades to a nonce).
 */
export function readSnapshotState(base: string): SnapshotState | undefined {
  if (unhealthySnapshots.has(base)) {
    return undefined;
  }
  const recovery = readUnhealthySnapshots(base);
  if (
    !recovery.readable ||
    recovery.paths.length !== 0 ||
    recovery.corruptPaths.length !== 0
  ) {
    return undefined;
  }
  const directory = snapshotDirectory(base);
  // Worker files strictly before the main file — see the module doc comment.
  const workers = readWorkerFiles(directory);
  if (!workers.readable || workers.corruptPaths.length !== 0) {
    return undefined;
  }
  const main = readMainDocument(directory);
  if (main === undefined || typeof main.id !== "string") {
    return undefined;
  }
  const files = new Set(main.files);
  let volatile = main.volatile;
  for (const entry of workers.entries) {
    for (const file of entry.files) {
      files.add(file);
    }
    volatile ||= entry.volatile;
  }
  return { files: [...files].sort(), id: main.id, volatile };
}

/**
 * Recorder held by each Metro worker. It persists out-of-walk watch inputs and
 * missing in-walk paths delivered through the transform core's `addWatchFile`
 * hook, plus any volatile declaration. Existing in-walk files stay covered by
 * the project walk; a missing path must be retained because its creation is a
 * state change that the initial walk could not hash. A clean in-walk transform
 * also writes a document so it can clear a volatile declaration from an earlier
 * run. The unique name makes worker writes race-free; `withTtsc` compacts the
 * files on the next run.
 */
export function createSnapshotRecorder(): {
  record: (props: {
    explicitProject?: string;
    input: string;
    projectRoot?: string;
  }) => void;
  recordVolatile: (props: {
    explicitProject?: string;
    projectRoot?: string;
  }) => void;
} {
  const suffix = `${process.pid.toString(36)}-${randomBytes(6).toString("hex")}`;
  interface BaseState {
    dirty: boolean;
    files: Set<string>;
    observed: boolean;
    roots: string[];
    volatile: boolean;
  }
  const states = new Map<string, BaseState>();

  function stateFor(
    projectRoot: string | undefined,
    explicitProject: string | undefined,
  ): BaseState {
    const base = resolveFingerprintBase(projectRoot);
    let state = states.get(base);
    if (state === undefined) {
      state = {
        dirty: false,
        files: new Set(),
        observed: false,
        roots: fingerprintRoots(base, explicitProject),
        volatile: false,
      };
      states.set(base, state);
    }
    return state;
  }

  function flush(base: string, state: BaseState): void {
    if (!state.dirty) {
      return;
    }
    const document: SnapshotDocument = {
      files: [...state.files].sort(),
      version: SNAPSHOT_VERSION,
      volatile: state.volatile,
    };
    try {
      const directory = snapshotDirectory(base);
      fs.mkdirSync(directory, { recursive: true });
      writeSnapshotDocument(
        path.join(directory, `${WORKER_SNAPSHOT_PREFIX}${suffix}.json`),
        document,
      );
      // Cleared only on success so a transient write failure retries on the
      // next recording instead of silently dropping the observed state.
      state.dirty = false;
    } catch (snapshotError) {
      try {
        persistUnhealthySnapshot(base, document);
      } catch (recoveryError) {
        if (hasReadableMainSnapshot(base)) {
          throw new AggregateError(
            [snapshotError, recoveryError],
            "Unable to persist a Metro snapshot observation or its recovery record.",
          );
        }
      }
    }
  }

  return {
    record(props) {
      const base = resolveFingerprintBase(props.projectRoot);
      const state = stateFor(props.projectRoot, props.explicitProject);
      const input = path.resolve(props.input);
      const firstObservation = !state.observed;
      state.observed = true;
      if (
        state.files.has(input) ||
        (fs.existsSync(input) &&
          state.roots.some((root) => isProjectWalkPath(root, input)))
      ) {
        // Even when every input belongs to the project walk, the worker must
        // publish that it performed a clean transform. Otherwise an old main
        // snapshot with `volatile: true` remains sticky forever.
        if (firstObservation || state.dirty) {
          state.dirty = true;
          flush(base, state);
        }
        return;
      }
      state.files.add(input);
      state.dirty = true;
      flush(base, state);
    },
    recordVolatile(props) {
      const base = resolveFingerprintBase(props.projectRoot);
      const state = stateFor(props.projectRoot, props.explicitProject);
      if (state.volatile) {
        flush(base, state);
        return;
      }
      state.volatile = true;
      state.dirty = true;
      flush(base, state);
    },
  };
}

function snapshotDirectory(base: string): string {
  return path.join(base, ...SNAPSHOT_DIRECTORY);
}

function snapshotCacheDirectory(base: string): string {
  return path.dirname(snapshotDirectory(base));
}

function hasReadableMainSnapshot(base: string): boolean {
  const main = readMainDocument(snapshotDirectory(base));
  return main !== undefined && typeof main.id === "string";
}

/**
 * Persist a failed observation where a read-only snapshot directory cannot hide
 * it.
 */
function persistUnhealthySnapshot(
  base: string,
  document: SnapshotDocument,
): void {
  unhealthySnapshots.add(base);
  const directory = snapshotCacheDirectory(base);
  fs.mkdirSync(directory, { recursive: true });
  writeSnapshotDocument(
    path.join(
      directory,
      `${UNHEALTHY_SNAPSHOT_PREFIX}${process.pid.toString(36)}-${randomBytes(8).toString("hex")}.json`,
    ),
    document,
  );
}

function readUnhealthySnapshots(base: string): SnapshotDocuments {
  return readSnapshotFiles(
    snapshotCacheDirectory(base),
    UNHEALTHY_SNAPSHOT_PREFIX,
  );
}

/**
 * Move each live worker document to a unique immutable name before reading it.
 * A concurrent worker publishes its next cumulative document at the original
 * name, so deleting the claimed copy after the main write can never erase a
 * newer observation. Claimed names still match the reader prefix, keeping the
 * worker-before-main visibility invariant during compaction.
 */
function claimWorkerFiles(directory: string): void {
  let names: string[];
  try {
    names = fs.readdirSync(directory);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }
    throw error;
  }
  const claim = `${process.pid.toString(36)}-${randomBytes(6).toString("hex")}`;
  for (const name of names) {
    if (
      !name.startsWith(WORKER_SNAPSHOT_PREFIX) ||
      name.startsWith(CLAIMED_WORKER_SNAPSHOT_PREFIX) ||
      !name.endsWith(".json")
    ) {
      continue;
    }
    try {
      fs.renameSync(
        path.join(directory, name),
        path.join(
          directory,
          `${CLAIMED_WORKER_SNAPSHOT_PREFIX}${claim}-${name.slice(WORKER_SNAPSHOT_PREFIX.length)}`,
        ),
      );
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }
}

function isClaimedWorkerSnapshot(file: string): boolean {
  return path.basename(file).startsWith(CLAIMED_WORKER_SNAPSHOT_PREFIX);
}

/**
 * Read every worker snapshot file in `directory`. A file that disappears
 * mid-read was compacted (merged into the main snapshot first) and is skipped;
 * a file that exists but does not parse is reported in `corruptPaths` so
 * readers can degrade to a nonce and the compactor can sweep it.
 */
function readWorkerFiles(directory: string): {
  corruptPaths: string[];
  entries: SnapshotDocument[];
  paths: string[];
  readable: boolean;
} {
  return readSnapshotFiles(directory, WORKER_SNAPSHOT_PREFIX);
}

function readSnapshotFiles(
  directory: string,
  prefix: string,
): SnapshotDocuments {
  let names: string[];
  try {
    names = fs.readdirSync(directory);
  } catch (error) {
    return {
      corruptPaths: [],
      entries: [],
      paths: [],
      readable: isMissingFileError(error),
    };
  }
  const entries: SnapshotDocument[] = [];
  const paths: string[] = [];
  const corruptPaths: string[] = [];
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith(".json")) {
      continue;
    }
    const file = path.join(directory, name);
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch (error) {
      if (!isMissingFileError(error)) {
        corruptPaths.push(file);
      }
      continue;
    }
    const parsed = parseSnapshotDocument(text);
    if (parsed === undefined) {
      corruptPaths.push(file);
      continue;
    }
    entries.push(parsed);
    paths.push(file);
  }
  return { corruptPaths, entries, paths, readable: true };
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function readMainDocument(directory: string): SnapshotDocument | undefined {
  let text: string;
  try {
    text = fs.readFileSync(path.join(directory, MAIN_SNAPSHOT), "utf8");
  } catch {
    return undefined;
  }
  return parseSnapshotDocument(text);
}

function parseSnapshotDocument(text: string): SnapshotDocument | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const document = value as Record<string, unknown>;
  if (document.version !== SNAPSHOT_VERSION || !Array.isArray(document.files)) {
    return undefined;
  }
  return {
    files: document.files.filter(
      (entry): entry is string => typeof entry === "string",
    ),
    ...(typeof document.id === "string" ? { id: document.id } : {}),
    version: SNAPSHOT_VERSION,
    volatile: document.volatile === true,
  };
}

/** Write a snapshot document atomically (unique temp file, then rename). */
function writeSnapshotDocument(file: string, document: SnapshotDocument): void {
  const temp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(document), "utf8");
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
}

/**
 * JSON-serialise with object keys sorted recursively, so two semantically equal
 * records always hash to the same fingerprint regardless of property order.
 * Shared with the transformer's option digest.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
