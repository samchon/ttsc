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
 * - **Recorded transform inputs.** The host-owned reference graph
 *   (samchon/ttsc#718) reports each transform's derived inputs. Workers retain
 *   them under `node_modules/.cache/ttsc-metro`, compare their generation state
 *   with the exact main-process key baseline, and batch one durable write per
 *   delivered module.
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
 * - A worker state that differs from the static key's run baseline taints the
 *   observation; compaction rotates the epoch so even A -> B -> A cannot reuse
 *   output stored under the earlier A key.
 */
import {
  captureWatchInputBaseline,
  collectProjectInputHashSnapshot,
  findNearestProjectTsconfig,
  findProjectTsconfigs,
  mergeMembershipPolicyOverlay,
  readProjectMembershipPolicy,
  readTsconfigSourceSnapshot,
  watchInputEvidenceMatchesBaseline,
} from "@ttsc/unplugin/api";
import type {
  TtscProjectTreeDiscoveryFilesystem,
  TtscWatchInput,
  TtscWatchInputBaseline,
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

/** Cache-key baseline file prefix, one immutable identity per Metro run. */
const KEY_BASELINE_PREFIX = "key-baseline-";

/** Union of the snapshot state readable on disk. */
interface SnapshotState {
  /** Random epoch id minted when the main snapshot was created. */
  id: string;
  /** Absolute paths of every recorded derived transform input. */
  files: string[];
  /** Whether any recorded transform declared volatile output. */
  volatile: boolean;
  /** Whether a transform observed state different from its run's static key. */
  tainted: boolean;
}

/** Serialized shape of the main and worker snapshot files. */
interface SnapshotDocument {
  files: string[];
  id?: string;
  tainted: boolean;
  version: number;
  volatile: boolean;
}

/** Main-process input states that one Metro run's static key actually used. */
interface KeyBaselineDocument {
  inputs: Record<string, TtscWatchInputBaseline>;
  runId: string;
  staticInputs: string[];
  version: number;
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
 * core treats as an input is fingerprinted by the walk, the recorded snapshot,
 * or both.
 */
export function fingerprintRoots(
  base: string,
  explicitProject: string | undefined,
): string[] {
  const explicit = normalizedExplicitProject(explicitProject);
  return projectViewRoots(
    base,
    resolveProjectTsconfig(base, explicit),
    explicit,
  );
}

/** Roots covered by one selected project's static walk. */
function projectViewRoots(
  base: string,
  tsconfig: string,
  explicitProject: string | undefined,
): string[] {
  // Containment, not walk membership. The question here is whether the
  // tsconfig's directory already sits inside the subtree the base walk covers,
  // so that adding it would repeat the same walk. `isProjectWalkPath` answers a
  // different question, whether the walk *hashes* that path, and once the walk
  // stopped hashing files that cannot enter the program it began answering
  // `false` for every `tsconfig.json`, which returned the base twice and hashed
  // the whole project twice on every cache key (samchon/ttsc#1307).
  const resolvedBase = path.resolve(base);
  const directory = path.dirname(path.resolve(tsconfig));
  const relative = path.relative(resolvedBase, directory);
  const inside =
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative));
  if (explicitProject === undefined && inside && directory !== resolvedBase) {
    return [directory];
  }
  return inside ? [resolvedBase] : [resolvedBase, directory];
}

/**
 * One project, and the membership policy that describes it.
 *
 * The recorder's question is whether the project walk already covers an input,
 * so it needs both the walk's roots and the policy that walk used, and it is
 * wrong exactly when those two describe different projects. Passing them
 * separately made that mismatch expressible — the policy for one project
 * alongside the root of another — and passing the policy alone made it
 * expressible in a quieter way still, since a recorder that resolved its own
 * could describe a different program than the walk hashed. Both halves travel
 * together so neither can be supplied without the other (samchon/ttsc#1316).
 */
export interface TtscMetroProjectView {
  /** The base directory both fingerprint sides agree on. */
  readonly base: string;
  /** Config candidates observed while selecting this transform's project. */
  readonly discoveryInputs: readonly TtscWatchInput[];
  /** The caller's explicit `project`, if any. */
  readonly explicitProject: string | undefined;
  /** The membership policy resolved for that project. */
  readonly policy: ReturnType<typeof readProjectMembershipPolicy>;
  /** The policy used by the routed static walk. */
  readonly walkPolicy: ReturnType<typeof readProjectMembershipPolicy>;
  /** Lexical roots whose fingerprint uses this project's policy. */
  readonly roots: readonly string[];
  /** The exact config selected for this project. */
  readonly tsconfig: string;
}

/** One stable implicit-project view and the config graph that produced it. */
interface TtscMetroFingerprintProjectView extends TtscMetroProjectView {
  readonly configSources: ReturnType<typeof readTsconfigSourceSnapshot>;
}

/** Stable routed projects plus every config candidate the map observed. */
interface TtscMetroFingerprintProjectMap {
  readonly discoveryInputs: readonly string[];
  readonly projects: readonly TtscMetroFingerprintProjectView[];
}

/**
 * Resolve one transform's project view, once, for every watch input it reports.
 *
 * Exported because the recorder is asked once per input while the answer is a
 * property of the project, and validating the memo means stat-ing the whole
 * `extends` chain (samchon/ttsc#1316).
 */
export function resolveProjectView(props: {
  compilerOptions?: Record<string, unknown>;
  explicitProject?: string;
  filename?: string;
  projectRoot?: string;
}): TtscMetroProjectView {
  const base = resolveFingerprintBase(props.projectRoot);
  const explicitProject = normalizedExplicitProject(props.explicitProject);
  const start =
    explicitProject === undefined && props.filename !== undefined
      ? path.dirname(path.resolve(props.filename))
      : base;
  const tsconfig = resolveProjectTsconfig(start, explicitProject);
  return createProjectView({
    base,
    compilerOptions: props.compilerOptions,
    discoveryStart: start,
    explicitProject,
    tsconfig,
  });
}

/** Create one cache view from an already selected project config. */
function createProjectView(props: {
  base: string;
  compilerOptions?: Record<string, unknown>;
  discoveryStart?: string;
  explicitProject: string | undefined;
  tsconfig: string;
}): TtscMetroProjectView {
  const policy = membershipPolicy(props.tsconfig, props.compilerOptions);
  return {
    base: props.base,
    discoveryInputs:
      props.discoveryStart === undefined
        ? []
        : captureProjectDiscoveryInputs(
            props.discoveryStart,
            props.tsconfig,
            props.explicitProject,
          ),
    explicitProject: props.explicitProject,
    policy,
    roots: projectViewRoots(props.base, props.tsconfig, props.explicitProject),
    tsconfig: props.tsconfig,
    walkPolicy: policy,
  };
}

/** Capture the config candidates whose state selected one worker project. */
function captureProjectDiscoveryInputs(
  start: string,
  tsconfig: string,
  explicitProject: string | undefined,
): TtscWatchInput[] {
  const selected = path.resolve(tsconfig);
  const candidates: string[] = [];
  if (explicitProject !== undefined) {
    candidates.push(selected);
  } else {
    let current = path.resolve(start);
    while (true) {
      const candidate = path.join(current, "tsconfig.json");
      candidates.push(candidate);
      if (samePath(candidate, selected)) {
        break;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        if (!candidates.some((entry) => samePath(entry, selected))) {
          candidates.push(selected);
        }
        break;
      }
      current = parent;
    }
  }
  return candidates.map((file): TtscWatchInput => {
    const baseline = captureWatchInputBaseline(file);
    if (baseline === undefined) {
      return { file };
    }
    return {
      evidence: {
        identity: baseline.identity,
        missing: !baseline.fileExists,
        state: {
          codec: "predicates",
          observation: { fileExists: baseline.fileExists },
        },
        unavailable: baseline.fileExists
          ? undefined
          : baseline.stat === "missing"
            ? "missing"
            : "not-file",
      },
      file,
    };
  });
}

/** Resolve one project policy from source rather than trusting metadata alone. */
function membershipPolicy(
  tsconfig: string,
  compilerOptions?: Record<string, unknown>,
): ReturnType<typeof readProjectMembershipPolicy> {
  // The caller overlay wins here exactly as it does for the compile. Re-reading
  // source is deliberate: a long-lived worker cannot validate config contents
  // from mtime and size, because a same-stamp rewrite is legal on coarse or
  // restored filesystems. `resolveProjectView` runs once per delivered module,
  // and its result is shared by the batched recorder.
  return mergeMembershipPolicyOverlay(
    readProjectMembershipPolicy(tsconfig),
    compilerOptions ?? {},
    path.dirname(path.resolve(tsconfig)),
  );
}

/**
 * Locate the tsconfig governing the project, mirroring the transform core's
 * discovery: an explicit `project` resolves against the working directory;
 * otherwise ancestor directories starting at `base` are searched for a
 * `tsconfig.json` file, falling back to `<cwd>/tsconfig.json` like the shared
 * transform core.
 */
function resolveProjectTsconfig(
  base: string,
  explicitProject: string | undefined,
): string {
  if (explicitProject !== undefined) {
    return path.isAbsolute(explicitProject)
      ? explicitProject
      : path.resolve(process.cwd(), explicitProject);
  }
  const discovered = findNearestProjectTsconfig(base);
  if (discovered !== undefined) {
    return discovered;
  }
  return path.resolve(process.cwd(), "tsconfig.json");
}

/** Empty project strings carry the same implicit meaning as omission. */
function normalizedExplicitProject(
  explicitProject: string | undefined,
): string | undefined {
  return explicitProject === undefined || explicitProject.length === 0
    ? undefined
    : explicitProject;
}

/** Resolve every implicit project whose files can be delivered below base. */
function fingerprintProjectViews(props: {
  compilerOptions?: Record<string, unknown>;
  explicitProject?: string;
  projectDiscoveryFilesystem?: TtscProjectTreeDiscoveryFilesystem;
  projectRoot?: string;
}): TtscMetroFingerprintProjectMap {
  const primary = resolveProjectView(props);
  if (primary.explicitProject !== undefined) {
    return {
      discoveryInputs: [primary.tsconfig],
      projects: [stableFingerprintProjectView(primary, props.compilerOptions)],
    };
  }
  const firstMap = findProjectTsconfigs(
    primary.base,
    props.projectDiscoveryFilesystem,
  );
  if (!firstMap.complete) {
    throw new Error(
      "Unable to enumerate Metro's implicit TypeScript projects.",
    );
  }
  const projects = [
    stableFingerprintProjectView(primary, props.compilerOptions),
  ];
  for (const tsconfig of firstMap.files) {
    const resolved = path.resolve(tsconfig);
    if (projects.some((project) => samePath(project.tsconfig, resolved))) {
      continue;
    }
    projects.push(
      stableFingerprintProjectView(
        createProjectView({
          base: primary.base,
          compilerOptions: props.compilerOptions,
          explicitProject: undefined,
          tsconfig: resolved,
        }),
        props.compilerOptions,
      ),
    );
  }
  const secondMap = findProjectTsconfigs(
    primary.base,
    props.projectDiscoveryFilesystem,
  );
  const selectedAfter = resolveProjectTsconfig(primary.base, undefined);
  if (
    !secondMap.complete ||
    !sameProjectMap(firstMap.files, secondMap.files) ||
    !sameProjectMap(firstMap.candidates, secondMap.candidates) ||
    !samePath(primary.tsconfig, selectedAfter) ||
    projects.some(
      (project) =>
        stableStringify(readTsconfigSourceSnapshot(project.tsconfig)) !==
        stableStringify(project.configSources),
    )
  ) {
    throw new Error("Metro's implicit TypeScript project map changed.");
  }
  const routedRoots = projects.map((project) => project.roots[0]!);
  return {
    discoveryInputs: firstMap.candidates,
    projects: projects.map((project, index) => {
      const root = routedRoots[index]!;
      const nestedRoots = routedRoots.filter(
        (candidate, candidateIndex) =>
          candidateIndex !== index &&
          !samePath(candidate, root) &&
          pathIsWithin(candidate, root),
      );
      return nestedRoots.length === 0
        ? project
        : {
            ...project,
            walkPolicy: {
              ...project.policy,
              excludedDirectories: [
                ...project.policy.excludedDirectories,
                ...nestedRoots,
              ],
            },
          };
    }),
  };
}

/** Read one implicit project's policy between equal complete config snapshots. */
function stableFingerprintProjectView(
  project: TtscMetroProjectView,
  compilerOptions?: Record<string, unknown>,
): TtscMetroFingerprintProjectView {
  const before = readTsconfigSourceSnapshot(project.tsconfig);
  const refreshed = createProjectView({
    base: project.base,
    compilerOptions,
    explicitProject: project.explicitProject,
    tsconfig: project.tsconfig,
  });
  const after = readTsconfigSourceSnapshot(project.tsconfig);
  if (
    before.some((entry) => entry.contents === null) ||
    after.some((entry) => entry.contents === null) ||
    stableStringify(before) !== stableStringify(after)
  ) {
    throw new Error("Unable to read a stable TypeScript project config graph.");
  }
  return { ...refreshed, configSources: after };
}

/** Whether two complete lexical config enumerations name the same paths. */
function sameProjectMap(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => samePath(entry, right[index]!))
  );
}

/** Host-platform equality for two resolved path spellings. */
function samePath(left: string, right: string): boolean {
  return path.relative(path.resolve(left), path.resolve(right)) === "";
}

/** Whether one resolved path lies at or below another. */
function pathIsWithin(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

/**
 * Compute the fingerprint `getCacheKey` folds into Metro's static transformer
 * key. Never throws: any failure degrades to a nonce, which soundly disables
 * cross-run cache reuse for this run instead of serving stale output.
 */
export function computeProjectFingerprint(props: {
  compilerOptions?: Record<string, unknown>;
  explicitProject?: string;
  /** Test seam for proving that incomplete implicit enumeration fails closed. */
  projectDiscoveryFilesystem?: TtscProjectTreeDiscoveryFilesystem;
  projectRoot?: string;
  /** Private identity transported from `withTtsc` to this Metro run. */
  runId?: string;
}): string {
  try {
    const base = resolveFingerprintBase(props.projectRoot);
    const before = observeProjectFingerprint(props);
    const after = observeProjectFingerprint(props);
    if (stableStringify(before) !== stableStringify(after)) {
      throw new Error("Metro's project fingerprint changed while observed.");
    }
    if (props.runId !== undefined) {
      writeKeyBaseline(base, props.runId, after.inputs, after.staticInputs);
    }
    const hash = createHash("sha256");
    hash.update(stableStringify(after.fingerprint));
    return hash.digest("hex");
  } catch {
    return nonce();
  }
}

/** One coherent static-key observation and the paths it proves. */
interface ProjectFingerprintObservation {
  fingerprint: unknown;
  inputs: Record<string, TtscWatchInputBaseline>;
  staticInputs: string[];
}

/** Build the complete value hashed by one static key. */
function observeProjectFingerprint(props: {
  compilerOptions?: Record<string, unknown>;
  explicitProject?: string;
  projectDiscoveryFilesystem?: TtscProjectTreeDiscoveryFilesystem;
  projectRoot?: string;
}): ProjectFingerprintObservation {
  // Judge the fingerprint's walk by the same configuration the compile does.
  // The caller overlay reaches this walk and the worker through the same
  // serialized options, so neither side can silently describe another program.
  const projectMap = fingerprintProjectViews(props);
  const inputs: Record<string, TtscWatchInputBaseline> = {};
  const staticInputs = new Set<string>();
  const configSources = new Map<
    string,
    { contents: string; identity: string }
  >();
  const projectFingerprints: unknown[] = [];
  for (const candidate of projectMap.discoveryInputs) {
    addBaselineInput(inputs, candidate, staticInputs);
  }
  for (const project of projectMap.projects) {
    for (const source of project.configSources) {
      const existing = configSources.get(source.path);
      if (existing !== undefined && existing.contents !== source.contents) {
        throw new Error("A TypeScript config changed during fingerprinting.");
      }
      const baseline = addBaselineInput(inputs, source.path, staticInputs);
      configSources.set(source.path, {
        contents: source.contents!,
        identity: baseline.identity,
      });
    }
    for (const root of project.roots) {
      const snapshot = collectProjectInputHashSnapshot(
        root,
        undefined,
        undefined,
        project.walkPolicy,
      );
      if (!snapshot.complete) {
        throw new Error("Unable to read a complete Metro project walk.");
      }
      const fingerprintedInputs: Record<
        string,
        { hash: string; identity: string }
      > = {};
      for (const [key, expected] of Object.entries(snapshot.hashes)) {
        const file = path.resolve(root, key);
        const baseline = addBaselineInput(inputs, file, staticInputs);
        if (baseline.hostHash !== expected) {
          throw new Error("A Metro project input changed while fingerprinted.");
        }
        fingerprintedInputs[key] = {
          hash: expected,
          identity: baseline.identity,
        };
      }
      projectFingerprints.push({
        inputs: fingerprintedInputs,
        root,
        tsconfig: project.tsconfig,
      });
    }
  }
  const snapshot = readSnapshotState(resolveFingerprintBase(props.projectRoot));
  if (snapshot === undefined || snapshot.volatile || snapshot.tainted) {
    throw new Error("Metro's recorded transform snapshot is not reusable.");
  }
  const recorded: Record<string, string> = {};
  for (const file of snapshot.files) {
    const baseline = addBaselineInput(inputs, file);
    recorded[baseline.identity] = baseline.hostHash;
  }
  return {
    fingerprint: {
      configSources: [...configSources].sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
      projects: projectFingerprints,
      snapshot: { id: snapshot.id, inputs: recorded },
    },
    inputs,
    staticInputs: [...staticInputs].sort(),
  };
}

/** Add one lexical path's stable broad state to a key baseline. */
function addBaselineInput(
  inputs: Record<string, TtscWatchInputBaseline>,
  file: string,
  staticInputs?: Set<string>,
): TtscWatchInputBaseline {
  const key = snapshotPathKey(file);
  const observed = captureWatchInputBaseline(file);
  if (observed === undefined) {
    throw new Error("Unable to read a stable Metro input baseline.");
  }
  const existing = inputs[key];
  if (
    existing !== undefined &&
    stableStringify(existing) !== stableStringify(observed)
  ) {
    throw new Error("A Metro input changed between baseline observations.");
  }
  inputs[key] = observed;
  staticInputs?.add(key);
  return observed;
}

/**
 * A value no other run can reproduce. Folding it means this run's cache entries
 * are written but never reused by later runs, and this run reuses nothing from
 * earlier ones — the sound fallback whenever the recorded transform input set
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
export function prepareSnapshot(projectRoot: string | undefined): string {
  const base = resolveFingerprintBase(projectRoot);
  const runId = randomBytes(16).toString("hex");
  let hadReadableMain = false;
  let pending: SnapshotDocument = {
    files: [],
    tainted: false,
    version: SNAPSHOT_VERSION,
    volatile: false,
  };
  try {
    // A nonexistent base can never be a working Metro setup (Metro verifies
    // the project root exists), so preparing a snapshot there would only
    // materialize directory trees at arbitrary paths.
    if (!fs.existsSync(base)) {
      return runId;
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
    const tainted = observations.some((entry) => entry.tainted);
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
        !recovering && workers.corruptPaths.length === 0 && !tainted
          ? (main?.id ?? randomBytes(16).toString("hex"))
          : randomBytes(16).toString("hex"),
      tainted: false,
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
      ...listExpiredKeyBaselines(directory),
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
  return runId;
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

/** Old run baselines that cannot belong to an ordinary live Metro session. */
function listExpiredKeyBaselines(directory: string): string[] {
  const horizon = Date.now() - 7 * 24 * 60 * 60 * 1000;
  try {
    return fs
      .readdirSync(directory)
      .filter(
        (name) =>
          name.startsWith(KEY_BASELINE_PREFIX) && name.endsWith(".json"),
      )
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
  let tainted = main.tainted;
  for (const entry of workers.entries) {
    for (const file of entry.files) {
      files.add(file);
    }
    volatile ||= entry.volatile;
    tainted ||= entry.tainted;
  }
  return { files: [...files].sort(), id: main.id, tainted, volatile };
}

/**
 * Recorder held by each Metro worker. It persists every derived watch input and
 * any volatile declaration, compares compiler-generation evidence with the
 * matching main-process run baseline, and marks any temporal mismatch tainted.
 * A clean transform also writes a document so it can clear a volatile
 * declaration from an earlier run. One cumulative document is flushed per
 * delivered module; the unique name makes worker writes race-free, and
 * `withTtsc` compacts the files on the next run.
 */
export function createSnapshotRecorder(runId?: string): {
  record: (props: {
    input: string;
    /**
     * The project this input belongs to, with the policy its walk uses,
     * resolved once per transform through {@link resolveProjectView}.
     *
     * One value rather than a root and a policy side by side, because the
     * recorder is wrong precisely when those two describe different projects.
     * Deriving the policy here instead would be the same fault in a quieter
     * form: a recorder that resolved its own could describe a different program
     * than the walk hashed, which is what happened when the caller's
     * compiler-options overlay reached one half and not the other, and the
     * input was then covered by neither (samchon/ttsc#1316).
     *
     * Resolving it once per transform also keeps every entry in the module's
     * batch attached to the exact same config graph and policy.
     */
    project: TtscMetroProjectView;
  }) => void;
  recordMany: (props: {
    inputs: readonly TtscWatchInput[];
    project: TtscMetroProjectView;
  }) => void;
  recordVolatile: (props: { project: TtscMetroProjectView }) => void;
} {
  const suffix = `${process.pid.toString(36)}-${randomBytes(6).toString("hex")}`;
  interface BaseState {
    dirty: boolean;
    files: Set<string>;
    observed: boolean;
    tainted: boolean;
    volatile: boolean;
  }
  const states = new Map<string, BaseState>();
  const baselines = new Map<string, KeyBaselineDocument | null>();
  const baselineStaticInputs = new Map<string, Set<string>>();

  function keyBaselineCoverage(
    input: TtscWatchInput,
    base: string,
  ): { matches: boolean; static: boolean } {
    // Direct recorder users without the private run handshake retain the
    // historical path-only behavior. Production always receives a run id from
    // `withTtsc`; an absent or unreadable matching baseline then fails closed.
    if (runId === undefined) {
      return { matches: true, static: false };
    }
    let baseline = baselines.get(base);
    if (baseline === undefined) {
      baseline = readKeyBaseline(base, runId) ?? null;
      baselines.set(base, baseline);
      baselineStaticInputs.set(base, new Set(baseline?.staticInputs ?? []));
    }
    const key = snapshotPathKey(input.file);
    const expected = baseline?.inputs[key];
    try {
      const matches =
        expected !== undefined &&
        input.evidence !== undefined &&
        watchInputEvidenceMatchesBaseline(input.evidence, expected);
      return {
        matches,
        static:
          matches &&
          baseline !== null &&
          baselineStaticInputs.get(base)?.has(key) === true,
      };
    } catch {
      return { matches: false, static: false };
    }
  }

  function stateFor(project: TtscMetroProjectView): BaseState {
    const base = project.base;
    let state = states.get(base);
    if (state === undefined) {
      state = {
        dirty: false,
        files: new Set(),
        observed: false,
        tainted: false,
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
      tainted: state.tainted,
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

  function recordMany(props: {
    inputs: readonly TtscWatchInput[];
    project: TtscMetroProjectView;
  }): void {
    const base = props.project.base;
    const state = stateFor(props.project);
    const firstObservation = !state.observed;
    state.observed = true;
    for (const input of props.inputs) {
      const file = path.resolve(input.file);
      const coverage = keyBaselineCoverage({ ...input, file }, base);
      if (!coverage.matches) {
        state.tainted = true;
      }
      if (!coverage.static && !state.files.has(file)) {
        state.files.add(file);
        state.dirty = true;
      }
    }
    // A clean empty delivery must still clear a volatile verdict from the
    // preceding run. Persist once for the whole module, not once per input.
    if (firstObservation || state.tainted) {
      state.dirty = true;
    }
    flush(base, state);
  }

  return {
    record(props) {
      recordMany({
        inputs: [{ file: props.input }],
        project: props.project,
      });
    },
    recordMany,
    recordVolatile(props) {
      const base = props.project.base;
      const state = stateFor(props.project);
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

/** Filesystem-keyed lexical spelling used by main and worker processes. */
function snapshotPathKey(file: string): string {
  const resolved = path.resolve(file);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Persist the exact filesystem state one run's static key observed. */
function writeKeyBaseline(
  base: string,
  runId: string,
  inputs: Record<string, TtscWatchInputBaseline>,
  staticInputs: string[],
): void {
  if (!/^[a-f0-9]{32}$/.test(runId)) {
    throw new Error("Invalid Metro snapshot run identity.");
  }
  const file = path.join(
    snapshotDirectory(base),
    `${KEY_BASELINE_PREFIX}${runId}.json`,
  );
  if (fs.existsSync(file)) {
    const existing = readKeyBaseline(base, runId);
    if (
      existing === undefined ||
      stableStringify(existing.inputs) !== stableStringify(inputs) ||
      stableStringify(existing.staticInputs) !== stableStringify(staticInputs)
    ) {
      throw new Error("A Metro run attempted to replace its key baseline.");
    }
    return;
  }
  writeSnapshotDocument(file, {
    inputs,
    runId,
    staticInputs,
    version: SNAPSHOT_VERSION,
  });
}

/** Read only the immutable baseline belonging to this worker's run. */
function readKeyBaseline(
  base: string,
  runId: string,
): KeyBaselineDocument | undefined {
  if (!/^[a-f0-9]{32}$/.test(runId)) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(
      fs.readFileSync(
        path.join(
          snapshotDirectory(base),
          `${KEY_BASELINE_PREFIX}${runId}.json`,
        ),
        "utf8",
      ),
    );
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    const document = value as Record<string, unknown>;
    if (
      document.version !== SNAPSHOT_VERSION ||
      document.runId !== runId ||
      typeof document.inputs !== "object" ||
      document.inputs === null ||
      Array.isArray(document.inputs) ||
      !Array.isArray(document.staticInputs) ||
      document.staticInputs.some((entry) => typeof entry !== "string")
    ) {
      return undefined;
    }
    return value as KeyBaselineDocument;
  } catch {
    return undefined;
  }
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
    tainted: document.tainted === true,
    version: SNAPSHOT_VERSION,
    volatile: document.volatile === true,
  };
}

/** Write a snapshot document atomically (unique temp file, then rename). */
function writeSnapshotDocument(
  file: string,
  document: SnapshotDocument | KeyBaselineDocument,
): void {
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
