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
 *   delivered module. Directory-listing predicates retain their paths
 *   separately so the next static key captures the exact compiler-accessible
 *   files and directories, rather than reconstructing an earlier baseline after
 *   workers have run.
 *
 * Snapshot layout: one main file carrying a random epoch id plus per-worker
 * files with unique names, so concurrent workers never race a shared write.
 * `withTtsc` compacts worker files into the main file before its workers exist,
 * under a process-shared lock for builds using the same project cache. Readers
 * take the union of every file, reading the worker files strictly before the
 * main file. The compactor renames each worker file to a claimed name first,
 * renames the merged main into place next, and deletes the claimed files last.
 * A name that vanishes between a reader's listing and its read may therefore be
 * a claim whose merge is not published yet, so the reader lists again until a
 * pass reads every name it saw, and degrades to a nonce when the directory does
 * not settle. A claimed file deleted after the merge is already inside the main
 * the reader loads afterwards. A worker file the compactor could not delete
 * stays, and the main names it as compacted, so no reader or later compaction
 * merges it twice.
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
  captureWatchInputFileBaseline,
  collectProjectInputHashSnapshot,
  discoverNearestProjectTsconfig,
  findNearestProjectTsconfig,
  findProjectTsconfigs,
  isWatchInputKeyBaseline,
  mergeMembershipPolicyOverlay,
  readProjectMembershipPolicy,
  readTsconfigSourceSnapshot,
  searchedReferencedProjects,
  watchInputEvidenceMatchesBaseline,
} from "@ttsc/unplugin/api";
import type {
  TtscProjectDiscoveryFilesystem,
  TtscProjectTreeDiscoveryFilesystem,
  TtscWatchInput,
  TtscWatchInputBaseline,
  TtscWatchInputKeyBaseline,
} from "@ttsc/unplugin/api";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Bumped when the snapshot JSON shape changes; mismatches read as corrupt. */
const SNAPSHOT_VERSION = 4;

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

/**
 * Listing passes a reader repeats while a listed snapshot name keeps vanishing
 * before it can be read. Each repeat needs another compactor to rename or
 * remove a file, so exhausting the bound means the directory is not settling
 * and the state cannot be proven.
 */
const SNAPSHOT_LISTING_ATTEMPTS = 8;

/** Directory lock serializing the one mutable main-snapshot rewrite. */
const SNAPSHOT_COMPACTION_LOCK = "snapshot-compaction.lock";

/** Complete owner record stored inside an atomically published lock. */
const SNAPSHOT_COMPACTION_OWNER = "owner.json";

/** Cache-key baseline file prefix, one immutable identity per Metro run. */
const KEY_BASELINE_PREFIX = "key-baseline-";

/** Run-token prefix that forces every transformer key to be non-reusable. */
const NON_REUSABLE_RUN_PREFIX = "nonce:";

/** Union of the snapshot state readable on disk. */
interface SnapshotState {
  /** Paths whose compiler-visible immediate entry listings affect output. */
  accessibleEntries: string[];

  /** Random epoch id minted when the main snapshot was created. */
  id: string;

  /** Absolute paths of every recorded derived transform input. */
  files: string[];

  /**
   * The recorded inputs that are plugin source directories, each also in
   * `files`, whose state the static key carries (samchon/ttsc#1487).
   */
  trees: string[];

  /** Whether any recorded transform declared volatile output. */
  volatile: boolean;

  /** Whether a transform observed state different from its run's static key. */
  tainted: boolean;
}

/** Serialized shape of the main and worker snapshot files. */
interface SnapshotDocument {
  /** Recorded listing predicates, each also present in files. */
  accessibleEntries: string[];

  /**
   * The claimed worker files this main snapshot already holds, by name. A
   * compaction removes each claimed file after merging it, and a removal can
   * fail (a Windows process holding the file); what stays behind is merged
   * again by no one. Present only on the main snapshot.
   */
  compacted?: string[];

  files: string[];
  id?: string;
  tainted: boolean;
  trees: string[];
  version: number;
  volatile: boolean;
}

/** Main-process input states that one Metro run's static key actually used. */
interface KeyBaselineDocument {
  inputs: Record<string, TtscWatchInputKeyBaseline>;
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
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node path.resolve provides one agreed base for config preparation, static
 *   keying and worker recording. A nonempty projectRoot wins; absent or empty
 *   input uses cwd.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One helper defines the shared base fallback for preparation, keying and
 *   worker recording instead of giving each boundary its own anchor policy.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   This operation delegates one path resolution and chooses a fallback; it
 *   owns no collection-processing strategy.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The base depends on caller input and current cwd; this pure mapping
 *   coordinates no shared computation.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   It returns a directory string and owns no retained state or handle.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   It computes a directory value without changing the filesystem, foreign
 *   APIs or consumer-specific behavior.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node path.resolve and process.cwd handle native path roots and separators
 *   on supported OSes. No URL conversion or process spawning occurs.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains shared base ownership and the absent/empty
 *   projectRoot fallback. Checked against the documentation skill: separate
 *   paragraphs state the contract and why its nonobvious boundary matters;
 *   field comments retain their own useful facts.
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
 * The directories whose walk universes the fingerprint hashes. Implicit
 * selection searches from the base upward, so a config at the base uses that
 * walk and a config above it adds its directory. An explicit project inside
 * the base uses the base walk; one outside adds its directory. The separate
 * per-file project view can select a nested config below the base. Matching
 * the transform core's validation universe keeps the invariant simple:
 * everything it treats as an input is fingerprinted by the walk, the recorded
 * snapshot, or both.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared project resolver owns tsconfig selection; lexical path
 *   containment is separate from program membership.
 *   Blank explicit options mean implicit discovery. An in-root config avoids a
 *   duplicate whole-tree walk; an out-of-root config adds its directory
 *   because it can supply transform inputs.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Project selection delegates to the shared resolver and containment to
 *   projectViewRoots, separating config ownership from walk-root choice.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   It delegates shared project discovery and computes at most two roots;
 *   traversal cost belongs to that resolver and the fingerprint operation.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This mapping retains no discovery result between calls and coordinates
 *   no completed or in-flight computation.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Roots transfer to the caller; no retained state or handle is acquired.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No fixture-specific roots or patched filesystem APIs are used.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node resolve and dirname handle Windows drives and POSIX roots. Lexical
 *   containment compares complete path components with only volume-root case
 *   normalization; it does not merge distinct native names by OS assumption.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains walk roots, implicit selection and why outside
 *   configs extend coverage. Checked against the documentation skill:
 *   separate paragraphs state the contract and why its nonobvious boundary
 *   matters; field comments retain their own useful facts.
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
  const inside = pathIsWithin(directory, resolvedBase);
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
 *
 * @evidence contracts/common.md#principled-implementation
 *   A readonly structural interface carries the selected config, discovery
 *   observations, membership policy and walk roots as one view.
 *   resolveProjectView supplies that coherent view to the recorder instead of
 *   independently resolving its parts.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The view groups config, policy, roots and discovery observations so a
 *   recorder receives one selected project rather than independently chosen
 *   pieces. Readonly members prevent replacement through this interface.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   This data contract declares the view, not an algorithm or processing path.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Sharing the view is owned by callers; this interface coordinates no work.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The view carries values; its consumers own retention and native lifetimes.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The type does not structurally prohibit an inconsistent manually
 *   constructed value; it introduces no executable branches, consumer
 *   exceptions or foreign mutation.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Its strings retain lexical filesystem paths and its discovery entries
 *   retain identity predicates from the host. The interface does not
 *   normalize paths, invoke processes or equate filesystem paths with URLs.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains each readonly field, one selected project and
 *   the reason policy and roots travel together. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
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
 * Discovery and membership policy are resolved once per delivered module and
 * shared by its recorder batch. The policy is read from source rather than
 * trusting a cached mtime/size observation, which could miss same-stamp edits.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Shared project discovery and membership-policy APIs select the same config
 *   as the transform core, retaining positive and negative discovery
 *   predicates. Compiler-option overlays are merged through that owner.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Selection records the predicates that chose the project, then one
 *   createProjectView helper assembles its policy and roots for every input
 *   in the module's recorder batch.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Discovery follows the ancestor candidates and config ancestry; the
 *   resulting policy and roots are assembled once for the delivered module.
 *   Each candidate gets one captured predicate rather than recorder-time
 *   rediscovery for every derived input.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The returned view is reused by the module's recorder batch; its selected
 *   tsconfig is passed to the transform options. Config sources are reread for
 *   a later module because matching mtime and size cannot establish continued
 *   equivalence.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Returned project data transfers to the caller. This operation retains no
 *   process-wide state or handle after discovery completes.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The view is resolved once per module and shared with its batch, avoiding
 *   independent recorder discovery without hardcoded project or test names.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node absolute paths and host discovery predicates retain native
 *   filesystem identity. The injected discovery filesystem is an explicit
 *   observation boundary, and path-relative helpers respect native roots; no
 *   shell command or global filesystem patch is used.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains selection inputs, returned coupled view,
 *   discovery evidence and per-module reuse. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
 */
export function resolveProjectView(props: {
  compilerOptions?: Record<string, unknown>;
  explicitProject?: string;
  filename?: string;
  projectDiscoveryFilesystem?: TtscProjectDiscoveryFilesystem;
  projectRoot?: string;
}): TtscMetroProjectView {
  const base = resolveFingerprintBase(props.projectRoot);
  const explicitProject = normalizedExplicitProject(props.explicitProject);
  const start =
    explicitProject === undefined && props.filename !== undefined
      ? path.dirname(path.resolve(props.filename))
      : base;
  const discovery =
    explicitProject === undefined
      ? discoverNearestProjectTsconfig(start, props.projectDiscoveryFilesystem)
      : undefined;
  const tsconfig =
    discovery === undefined
      ? resolveProjectTsconfig(start, explicitProject)
      : (discovery.file ?? path.resolve(process.cwd(), "tsconfig.json"));
  const discoveryInputs =
    discovery === undefined
      ? [captureProjectDiscoveryInput(tsconfig)]
      : discovery.candidates.map((candidate) =>
          captureProjectDiscoveryInput(candidate.file, candidate.fileExists),
        );
  if (!discoveryInputs.some((input) => samePath(input.file, tsconfig))) {
    discoveryInputs.push(captureProjectDiscoveryInput(tsconfig));
  }
  return createProjectView({
    base,
    compilerOptions: props.compilerOptions,
    discoveryInputs,
    explicitProject,
    tsconfig,
  });
}

/** Create one cache view from an already selected project config. */
function createProjectView(props: {
  base: string;
  compilerOptions?: Record<string, unknown>;
  discoveryInputs?: readonly TtscWatchInput[];
  explicitProject: string | undefined;
  tsconfig: string;
}): TtscMetroProjectView {
  const policy = membershipPolicy(props.tsconfig, props.compilerOptions);
  return {
    base: props.base,
    discoveryInputs: props.discoveryInputs ?? [],
    explicitProject: props.explicitProject,
    policy,
    roots: projectViewRoots(props.base, props.tsconfig, props.explicitProject),
    tsconfig: props.tsconfig,
    walkPolicy: policy,
  };
}

/** Attach identity to the exact file predicate that selected a worker project. */
function captureProjectDiscoveryInput(
  file: string,
  selectedFileExists?: boolean,
): TtscWatchInput {
  const baseline = captureWatchInputFileBaseline(file);
  if (baseline === undefined) {
    return { file };
  }
  const fileExists = selectedFileExists ?? baseline.fileExists;
  return {
    evidence: {
      identity: baseline.identity,
      missing: !fileExists,
      state: {
        codec: "predicates",
        observation: { fileExists },
      },
      unavailable: fileExists ? undefined : "not-file",
    },
    file,
  };
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
  // A solution config routes its files to the projects it references, and the
  // worker compiles those (samchon/ttsc#1397), so their configs and inputs
  // key the cache as well. The solution's own snapshot covers its list.
  for (const project of [...projects]) {
    for (const referenced of searchedReferencedProjects(project.tsconfig)) {
      if (
        !fs.existsSync(referenced) ||
        projects.some((known) => samePath(known.tsconfig, referenced))
      ) {
        continue;
      }
      projects.push(
        stableFingerprintProjectView(
          createProjectView({
            base: primary.base,
            compilerOptions: props.compilerOptions,
            explicitProject: undefined,
            tsconfig: referenced,
          }),
          props.compilerOptions,
        ),
      );
    }
  }
  const secondMap = findProjectTsconfigs(
    primary.base,
    props.projectDiscoveryFilesystem,
  );
  const selectedAfter = resolveProjectView(props);
  if (
    !secondMap.complete ||
    !sameProjectMap(firstMap.files, secondMap.files) ||
    !sameProjectMap(firstMap.candidates, secondMap.candidates) ||
    !samePath(primary.tsconfig, selectedAfter.tsconfig) ||
    stableStringify(primary.discoveryInputs) !==
      stableStringify(selectedAfter.discoveryInputs) ||
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
    // `findProjectTsconfigs` covers candidates at and below Metro's base. The
    // primary nearest-config search can also cross above that base to a
    // monorepo config, and every rejected candidate on that ancestor path is
    // just as capable of changing the selected project. Keep both sets in the
    // main-process baseline so a worker does not taint every unchanged run for
    // reporting a candidate the static key itself used.
    discoveryInputs: [
      ...new Set([
        ...primary.discoveryInputs.map((input) => input.file),
        ...firstMap.candidates,
      ]),
    ].sort(),
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

/** Equality of resolved lexical spellings, preserving distinct native names. */
function samePath(left: string, right: string): boolean {
  return snapshotPathKey(left) === snapshotPathKey(right);
}

/** Whether one resolved path lies at or below another. */
function pathIsWithin(child: string, parent: string): boolean {
  const childKey = snapshotPathKey(child);
  const parentKey = snapshotPathKey(parent);
  return (
    childKey === parentKey ||
    childKey.startsWith(
      parentKey.endsWith(path.sep) ? parentKey : `${parentKey}${path.sep}`,
    )
  );
}

/**
 * Compute the fingerprint `getCacheKey` folds into Metro's static transformer
 * key. Never throws: any failure degrades to a nonce, which soundly disables
 * cross-run cache reuse for this run instead of serving stale output.
 *
 * A successful call makes two complete observations of the routed projects,
 * config sources and recorded inputs. Work scales with their files and bytes;
 * it is paid at Metro's static-key boundary, not once per delivered module. The
 * run baseline retains exact hashes, identities and discovery predicates so a
 * worker can prove that its generation matches the state keyed here.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared project walker/policy and input-state APIs supply real file,
 *   config, identity and recorded-input observations. Two complete
 *   observations must agree before Node sha256 publishes the key and immutable
 *   run baseline. Missing, volatile, incomplete or changing state yields
 *   randomBytes nonce, a required withdrawal of reuse rather than a successful
 *   stale fallback. Injected discovery changes observation only, not
 *   production results.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The entry point compares two observations and publishes their baseline;
 *   observeProjectFingerprint owns collecting the complete input universe.
 *   Nonreusable state has one nonce exit rather than partial-success keys.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Two observations scan project files and recorded inputs, with time driven
 *   by their bytes and config graph size. Overlapping lexical project walks
 *   are excluded by routed roots; maps deduplicate config sources. Exact
 *   content observations are necessary because timestamps do not prove state.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The static key shares transforms only for equal options, config contents,
 *   file hashes, identities, recorded generation state and requested exact
 *   compiler-accessible entry listings. Volatile, tainted
 *   or unstable observations take a fresh nonce; a run baseline must be
 *   immutable before workers can claim its coverage.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Observation maps are local to key computation and are released on return.
 *   The persisted run baseline is owned by snapshot preparation, which sweeps
 *   old baselines. A long-running worker can retain its loaded baseline until
 *   worker termination; it owns no open handle here.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node paths/fs preserve native roots and physical identities, including
 *   symlink-aware discovery. Sorted key representation is deterministic; file
 *   bytes and host predicates remain inputs. Filesystem failure withdraws
 *   reuse consistently instead of becoming an OS-specific successful key.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains hex digest versus nonce, repeated observation,
 *   private baseline publication and failure policy. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
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
  inputs: Record<string, TtscWatchInputKeyBaseline>;
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
  const inputs: Record<string, TtscWatchInputKeyBaseline> = {};
  const staticInputs = new Set<string>();
  const configSources = new Map<
    string,
    { contents: string; identity: string }
  >();
  const projectFingerprints: unknown[] = [];
  for (const candidate of projectMap.discoveryInputs) {
    addDiscoveryBaselineInput(inputs, candidate, staticInputs);
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
  // A plugin's Go source is a recorded input like any other, but no one
  // path's state stands for the files below it, so the key carries its state
  // (samchon/ttsc#1487).
  const trees = new Set(snapshot.trees);
  const accessibleEntries = new Set(snapshot.accessibleEntries);
  const recorded: Record<
    string,
    {
      hash: string;
      identity: string;
      tree?: string | null;
      accessibleEntries?: TtscWatchInputBaseline["accessibleEntries"];
    }
  > = {};
  for (const file of snapshot.files) {
    const baseline = addBaselineInput(
      inputs,
      file,
      undefined,
      trees.has(file),
      accessibleEntries.has(file),
    );
    recorded[snapshotPathKey(file)] = {
      hash: baseline.hostHash,
      identity: baseline.identity,
      ...(baseline.tree === undefined ? {} : { tree: baseline.tree }),
      ...(baseline.accessibleEntries === undefined
        ? {}
        : { accessibleEntries: baseline.accessibleEntries }),
    };
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

/**
 * Add one lexical path's stable broad state to a key baseline, with its plugin
 * source state when it was recorded as a plugin source directory (`tree`).
 * Recorded listing predicates request exact immediate accessible entries; these
 * optional payloads merge only after their shared broad state agrees.
 */
function addBaselineInput(
  inputs: Record<string, TtscWatchInputKeyBaseline>,
  file: string,
  staticInputs?: Set<string>,
  tree = false,
  accessibleEntries = false,
): TtscWatchInputBaseline {
  const key = snapshotPathKey(file);
  const observed = captureWatchInputBaseline(file, undefined, {
    tree,
    accessibleEntries,
  });
  if (observed === undefined) {
    throw new Error("Unable to read a stable Metro input baseline.");
  }
  const existing = inputs[key];
  if (existing !== undefined) {
    // One path observed as a plugin source and as a plain input compares on
    // what both observations carry.
    const {
      tree: existingTree,
      accessibleEntries: existingEntries,
      ...existingState
    } = existing as TtscWatchInputBaseline;
    const {
      tree: observedTree,
      accessibleEntries: observedEntries,
      ...observedState
    } = observed;
    if (
      existing.identity !== observed.identity ||
      existing.fileExists !== observed.fileExists ||
      ("hostHash" in existing &&
        stableStringify(existingState) !== stableStringify(observedState)) ||
      (existingTree !== undefined &&
        observedTree !== undefined &&
        existingTree !== observedTree) ||
      (existingEntries !== undefined &&
        observedEntries !== undefined &&
        (stableStringify(existingEntries.files) !==
          stableStringify(observedEntries.files) ||
          stableStringify(existingEntries.directories) !==
            stableStringify(observedEntries.directories)))
    ) {
      throw new Error("A Metro input changed between baseline observations.");
    }
    inputs[key] = { ...existing, ...observed };
  } else {
    inputs[key] = observed;
  }
  staticInputs?.add(key);
  return observed;
}

/** Add the stable file predicate used by the project-map traversal. */
function addDiscoveryBaselineInput(
  inputs: Record<string, TtscWatchInputKeyBaseline>,
  file: string,
  staticInputs: Set<string>,
): void {
  const key = snapshotPathKey(file);
  const observed = captureWatchInputFileBaseline(file);
  if (observed === undefined) {
    throw new Error("Unable to read a stable Metro project candidate.");
  }
  const existing = inputs[key];
  if (
    existing !== undefined &&
    (existing.identity !== observed.identity ||
      existing.fileExists !== observed.fileExists)
  ) {
    throw new Error("A Metro project candidate changed while observed.");
  }
  inputs[key] = existing ?? observed;
  staticInputs.add(key);
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
 * Prepare the snapshot for a new run. Called from `withTtsc` before any worker
 * exists: creates the main snapshot (fresh epoch id) when missing or corrupt,
 * compacts leftover worker files into it, and sweeps unparseable worker files
 * plus crash-leftover temp files. Concurrent config processes are serialized; a
 * contender takes a non-reusable run token instead of racing the mutable main
 * rewrite. An unparseable worker file's recordings are unrecoverable, so its
 * removal mints a fresh epoch id — every key that might have depended on the
 * lost recordings is soundly orphaned, and later runs stabilize instead of
 * degrading to a nonce forever. A failed rewrite leaves a recovery document
 * outside the snapshot directory and returns a non-reusable run token. The
 * token crosses bundle and process boundaries, so `getCacheKey` degrades to a
 * nonce even when neither snapshot location can persist the failure and an old
 * main later reappears.
 *
 * Compaction reads the accumulated worker and recovery documents and unions
 * their recorded paths. Workers have unique names; completed observations are
 * published before removal. Locked claimed files remain until a later retry.
 * Old temporary files and run baselines are swept, but recorded input paths
 * accumulate in the main snapshot and dead-owner election directories remain to
 * prevent delayed contenders from moving a newer lock. Those populations are
 * not bounded by a fixed retention budget in this implementation.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node filesystem APIs atomically publish complete snapshot documents and a
 *   token-owned compaction lock. Worker claims are merged before deletion;
 *   retained claims are identified in the main document to prevent replay.
 *   Definite dead-PID recovery preserves an election record; contention or
 *   failed persistence returns a private nonreusable token.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Preparation owns one lock-protected main rewrite. Helpers separate worker
 *   claims, document parsing, atomic publication and recovery storage, so
 *   concurrent readers can use the same persisted protocol.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Sets union recorded paths in time proportional to document paths, then
 *   sorting gives deterministic output. Each claimed worker is merged once;
 *   readdir and document parsing remain necessary to find pending publishers.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The main document records claimed worker names before removal, preventing
 *   locked files from replaying completed compaction. The epoch survives only
 *   trusted, untainted observations; corrupt or lost evidence rotates it.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Preparation owns its compaction lock and retires it in finally. Claimed
 *   workers and recovery files are removed after publication; failed removals
 *   stay represented for retry. Temporary files and baselines have age sweeps,
 *   but cumulative input paths and stale-owner election records have no fixed
 *   bound. Removing these without a generation protocol could erase evidence.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Retries serve locked-file/recovery contracts rather than masking an
 *   uncorrected successful-state assumption.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node join, mkdir, rename and rm implement native cache paths.
 *   Windows-locked files remain represented for a later removal attempt; only
 *   a definite process-query absence permits dead-owner recovery. No shell
 *   process checks or patched fs methods are used.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains new-run preparation, contention, epoch
 *   rotation, recovery storage and nonreusable tokens. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
 */
export function prepareSnapshot(projectRoot: string | undefined): string {
  const base = resolveFingerprintBase(projectRoot);
  const runId = randomBytes(16).toString("hex");
  let reusable = true;
  let pending: SnapshotDocument = {
    accessibleEntries: [],
    files: [],
    tainted: false,
    trees: [],
    version: SNAPSHOT_VERSION,
    volatile: false,
  };
  let releaseCompactionLock: (() => void) | undefined;
  try {
    // A nonexistent base can never be a working Metro setup (Metro verifies
    // the project root exists), so preparing a snapshot there would only
    // materialize directory trees at arbitrary paths.
    if (!fs.existsSync(base)) {
      return runId;
    }
    const directory = snapshotDirectory(base);
    fs.mkdirSync(directory, { recursive: true });
    releaseCompactionLock = acquireSnapshotCompactionLock(directory);
    if (releaseCompactionLock === undefined) {
      // Another Metro config process is already rewriting the mutable main
      // snapshot. It owns all pending worker documents, while this run takes a
      // private nonce and therefore cannot reuse or publish under a stale key.
      return `${NON_REUSABLE_RUN_PREFIX}${runId}`;
    }
    // Read the worker files strictly before the main file (see the module doc
    // comment). The lock keeps another compactor from claiming or deleting a
    // file during these reads, and a vanished name still forces a fresh listing.
    claimWorkerFiles(directory);
    const recovery = readUnhealthySnapshots(base);
    const workers = readWorkerFiles(directory);
    if (!recovery.readable || !workers.readable) {
      throw new Error("Unable to enumerate Metro snapshot state.");
    }
    const main = readMainDocument(directory);
    const files = new Set(main?.files ?? []);
    const trees = new Set(main?.trees ?? []);
    const accessibleEntries = new Set(main?.accessibleEntries ?? []);
    const observations = [
      ...recovery.entries,
      ...uncompactedWorkerEntries(workers, main),
    ];
    // Every claimed file present is recorded before any is removed, so one
    // whose removal fails, or a compactor that stops between the two, leaves a
    // file the next compaction knows it already merged.
    const compacted = workers.paths
      .filter(isClaimedWorkerSnapshot)
      .map((file) => path.basename(file))
      .sort();
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
      for (const tree of entry.trees) {
        trees.add(tree);
      }
      for (const file of entry.accessibleEntries) {
        accessibleEntries.add(file);
      }
    }
    const recovering =
      unhealthySnapshots.has(base) ||
      recovery.paths.length !== 0 ||
      recovery.corruptPaths.length !== 0;
    pending = {
      accessibleEntries: [...accessibleEntries].sort(),
      ...(compacted.length !== 0 ? { compacted } : {}),
      files: [...files].sort(),
      id:
        !recovering && workers.corruptPaths.length === 0 && !tainted
          ? (main?.id ?? randomBytes(16).toString("hex"))
          : randomBytes(16).toString("hex"),
      tainted: false,
      trees: [...trees].sort(),
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
        // A locked file stays for a later compaction. The main snapshot names
        // claimed workers it merged, so readers do not replay them.
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
  } catch {
    reusable = false;
    try {
      persistUnhealthySnapshot(base, pending);
    } catch {
      // The returned token carries the failure when neither on-disk location
      // can. No consumer may turn that token into a reusable cache key.
    }
  } finally {
    if (releaseCompactionLock !== undefined) {
      try {
        releaseCompactionLock();
      } catch {
        reusable = false;
        try {
          persistUnhealthySnapshot(base, pending);
        } catch {
          // The returned non-reusable token remains the final safety boundary.
        }
      }
    }
  }
  return reusable ? runId : `${NON_REUSABLE_RUN_PREFIX}${runId}`;
}

/**
 * Acquire the process-shared lock for the mutable main snapshot.
 *
 * A complete owner directory is published atomically, and no process waits
 * while holding a reusable run identity. A contending process therefore
 * degrades immediately to a nonce. The owner retires the directory atomically
 * after every success or failure path has persisted its verdict.
 */
function acquireSnapshotCompactionLock(
  directory: string,
): (() => void) | undefined {
  const lock = path.join(directory, SNAPSHOT_COMPACTION_LOCK);
  const token = randomBytes(16).toString("hex");
  const candidate = path.join(
    directory,
    `.snapshot-compaction-${process.pid.toString(36)}-${token}`,
  );
  let candidateCreated = false;
  try {
    fs.mkdirSync(candidate);
    candidateCreated = true;
    fs.writeFileSync(
      path.join(candidate, SNAPSHOT_COMPACTION_OWNER),
      JSON.stringify({ pid: process.pid, token }),
      "utf8",
    );
    if (fs.existsSync(lock)) {
      reapDeadSnapshotCompactionLock(lock);
      return undefined;
    }
    fs.renameSync(candidate, lock);
    candidateCreated = false;
  } catch (error) {
    if (fs.existsSync(lock)) {
      reapDeadSnapshotCompactionLock(lock);
      return undefined;
    }
    throw error;
  } finally {
    if (candidateCreated) {
      fs.rmSync(candidate, { force: true, recursive: true });
    }
  }
  return () => {
    const owner = readSnapshotCompactionOwner(lock);
    if (owner?.pid !== process.pid || owner.token !== token) {
      throw new Error("Metro snapshot compaction lock ownership changed.");
    }
    const retired = path.join(
      directory,
      `.snapshot-compaction-released-${token}`,
    );
    fs.renameSync(lock, retired);
    try {
      fs.rmSync(retired, { force: true, recursive: true });
    } catch {
      // A retired owner cannot block or be confused with the fixed lock name.
    }
  };
}

/** Read a complete lock owner; malformed state remains a conservative lock. */
function readSnapshotCompactionOwner(
  lock: string,
): { pid: number; token: string } | undefined {
  try {
    const value: unknown = JSON.parse(
      fs.readFileSync(path.join(lock, SNAPSHOT_COMPACTION_OWNER), "utf8"),
    );
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    const owner = value as Record<string, unknown>;
    return Number.isSafeInteger(owner.pid) &&
      (owner.pid as number) > 0 &&
      typeof owner.token === "string" &&
      /^[a-f0-9]{32}$/.test(owner.token)
      ? { pid: owner.pid as number, token: owner.token }
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Remove a lock whose recorded process is proven dead.
 *
 * The dead owner's random token also names its quarantine. At most one
 * contender can move the fixed lock there. The quarantine remains as a tiny
 * election record, so a delayed contender can never move a newer owner's lock
 * after the first contender has recovered the fixed name.
 */
function reapDeadSnapshotCompactionLock(lock: string): void {
  const owner = readSnapshotCompactionOwner(lock);
  if (owner === undefined || processIsAlive(owner.pid)) return;
  const quarantine = path.join(
    path.dirname(lock),
    `.snapshot-compaction-stale-${owner.token}`,
  );
  try {
    fs.renameSync(lock, quarantine);
  } catch {
    // Another contender recovered this owner, or the lock changed after read.
  }
}

/** Treat every process-query failure except a definite missing PID as live. */
function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
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
 * missing, any snapshot file is corrupt (a torn or foreign write means the
 * recorded set cannot be trusted, so the caller degrades to a nonce), or a
 * concurrent compaction keeps renaming worker files so the listing never settles.
 *
 * The result contains sorted absolute file and tree paths, the epoch identity,
 * and tainted/volatile flags. It reads persisted evidence without revalidating
 * current file bytes; the fingerprint operation owns that validation. Reading
 * costs the number and size of outstanding documents plus their unioned paths.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Strict snapshot parsing and Set union read worker documents before the
 *   main publication, retaining file/tree/volatile/tainted state without
 *   replaying already compacted claims. This is the owned persisted-input
 *   protocol, not a separate compiler dependency model.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This reader validates persisted documents and unions their paths without
 *   recomputing file state. The fingerprint owner handles live validation;
 *   both reader and compactor share uncompacted-worker classification.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Reading costs document bytes plus Set insertion and final path sorting.
 *   The compacted-name Set avoids replay and avoids a linear search per worker.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This read must observe new worker publications; it coordinates no cache
 *   between calls. Cross-run reuse belongs to computeProjectFingerprint.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Returned snapshot data transfers to the caller. This reader retains no
 *   state or handle after synchronous reads finish.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Unknown, corrupt or recovery-pending state returns undefined, never an
 *   invented complete empty set.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node path and fs read native snapshot locations. Locked or unreadable
 *   directory/documents invalidate the proof on all supported OSes; sorted
 *   lexical paths remain values, not shell arguments.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains unioned snapshot fields, read ordering and the
 *   undefined result for untrusted state. Checked against the documentation
 *   skill: separate paragraphs state the contract and why its nonobvious
 *   boundary matters; field comments retain their own useful facts.
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
  const trees = new Set(main.trees);
  const accessibleEntries = new Set(main.accessibleEntries);
  let volatile = main.volatile;
  let tainted = main.tainted;
  for (const entry of uncompactedWorkerEntries(workers, main)) {
    for (const file of entry.files) {
      files.add(file);
    }
    for (const tree of entry.trees) {
      trees.add(tree);
    }
    for (const file of entry.accessibleEntries) {
      accessibleEntries.add(file);
    }
    volatile ||= entry.volatile;
    tainted ||= entry.tainted;
  }
  return {
    accessibleEntries: [...accessibleEntries].sort(),
    files: [...files].sort(),
    id: main.id,
    tainted,
    trees: [...trees].sort(),
    volatile,
  };
}

/**
 * Recorder held by each Metro worker. It persists every derived watch input and
 * any volatile declaration, compares compiler-generation evidence with the
 * matching main-process run baseline, and marks any temporal mismatch tainted.
 * A clean transform also writes a document so it can clear a volatile
 * declaration from an earlier run. The first delivery, a delivery that adds a
 * path, and every delivery once the state is tainted flush one cumulative
 * document; the unique name makes worker writes race-free, and `withTtsc`
 * compacts the files on the next run.
 *
 * `record` accepts one lexical path without generation evidence; `recordMany`
 * accepts a module's generation evidence; `recordVolatile` withdraws the file
 * proof for non-file inputs. Without a run identity every input is retained;
 * production passes the identity whose immutable baseline was keyed in the main
 * process. An unknown or mismatching baseline marks the snapshot tainted, and
 * since `record` carries no evidence, a run identity always reads it as a
 * mismatch.
 * Listing predicates retain their paths for the next run's key observation; the
 * worker never adds a new disk read to its earlier immutable baseline.
 *
 * Sets and baseline maps live for the recorder's worker lifetime and grow with
 * observed projects and distinct inputs. A flushing delivery serializes the
 * cumulative recorded set once, not once per input, but a tainted state flushes
 * on every delivery, so its cost grows with the recorded set for each module. A
 * failed write remains dirty for retry and tries recovery storage. If both
 * stores fail, a reusable run throws rather than publishing output backed by
 * lost evidence.
 *
 * @evidence contracts/common.md#principled-implementation
 *   One worker closure retains derived inputs and compares their
 *   compiler-generation evidence with its immutable run baseline through
 *   shared validation APIs. Static coverage is omitted only after a matching
 *   proof; unknown/volatile inputs persist taint.
 *   Listing and plugin-tree paths stay in the retained file universe even
 *   when a static proof already covers them, so optional payloads survive
 *   subsequent compaction and key capture.
 *   A first or changed module batch publishes one cumulative atomic document,
 *   with recovery storage and AggregateError when a reusable generation cannot
 *   persist either record.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One worker closure owns recorder state; shared recordMany owns evidence
 *   comparison and batch publication for single and multiple inputs. flush
 *   owns durability, so volatile observations use the same failure policy.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Sets insert distinct inputs and a cached static-input Set checks coverage
 *   without searching the whole baseline. A flushing module serializes the
 *   cumulative paths once, costing their count and encoded bytes rather than
 *   one cumulative serialization for every input. A tainted state flushes on
 *   every module, so that cost recurs per delivery until the worker ends.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Each base loads its immutable run baseline once and shares it across
 *   module batches. Only matching generation evidence authorizes omission of
 *   static paths; missing or differing evidence records taint instead.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The worker owns maps of bases, baseline bytes and distinct recorded paths
 *   until termination. Population grows with projects and inputs observed in
 *   that worker; there is no fixed eviction budget. Persisted files transfer
 *   to the next preparation's compactor. No native handle remains open.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The legacy no-run handshake records all paths without claiming static
 *   coverage.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node resolve/join and atomic rename use native paths; unique PID/random
 *   worker names separate publishers. Windows-locked claims remain readable
 *   until later compaction, and persistence failures follow the same reuse
 *   withdrawal contract. No foreign filesystem or process method is replaced.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains record, batch and volatile operations,
 *   run-baseline matching, cumulative persistence and failure ownership.
 *   Checked against the documentation skill: separate paragraphs state the
 *   contract and why its nonobvious boundary matters; field comments retain
 *   their own useful facts.
 */
export function createSnapshotRecorder(runId?: string): {
  /** Record one lexical input without claiming compiler-generation evidence. */
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

  /** Record one module's input evidence and publish its cumulative snapshot. */
  recordMany: (props: {
    inputs: readonly TtscWatchInput[];
    project: TtscMetroProjectView;
  }) => void;

  /** Persist that a project's output depends on inputs a file key cannot prove. */
  recordVolatile: (props: { project: TtscMetroProjectView }) => void;
} {
  const suffix = `${process.pid.toString(36)}-${randomBytes(6).toString("hex")}`;
  interface BaseState {
    accessibleEntries: Set<string>;
    dirty: boolean;
    files: Set<string>;
    observed: boolean;
    tainted: boolean;
    trees: Set<string>;
    volatile: boolean;
  }
  const states = new Map<string, BaseState>();
  const baselines = new Map<string, KeyBaselineDocument | null>();
  const baselineStaticInputs = new Map<string, Set<string>>();

  function keyBaselineCoverage(
    input: TtscWatchInput,
    base: string,
  ): { matches: boolean; static: boolean } {
    // A direct recorder without the private run handshake cannot prove that
    // any input belongs to the main process's static key. Retain every path
    // without claiming a temporal mismatch. Production always receives a run
    // id from `withTtsc`; an absent or unreadable matching baseline then fails
    // closed.
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
        accessibleEntries: new Set(),
        dirty: false,
        files: new Set(),
        observed: false,
        tainted: false,
        trees: new Set(),
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
      accessibleEntries: [...state.accessibleEntries].sort(),
      files: [...state.files].sort(),
      tainted: state.tainted,
      trees: [...state.trees].sort(),
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
        // A reusable run id proves that the main process authorized a cache
        // key. The explicit nonce token is different: it guarantees that this
        // run's output cannot be reused, so losing its observation is safe.
        if (
          isReusableSnapshotRunId(runId) ||
          (runId === undefined && hasReadableMainSnapshot(base))
        ) {
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
      // A plugin source directory is recorded as one, so the next run's key
      // carries its state (samchon/ttsc#1487).
      if (input.evidence?.state?.codec === "tree" && !state.trees.has(file)) {
        state.files.add(file);
        state.trees.add(file);
        state.dirty = true;
      }
      if (
        input.evidence?.state?.codec === "predicates" &&
        input.evidence.state.observation.accessibleEntries !== undefined &&
        !state.accessibleEntries.has(file)
      ) {
        state.files.add(file);
        state.accessibleEntries.add(file);
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

/**
 * Lexical spelling used by main and worker processes. Native name case stays
 * exact because an OS name cannot establish directory case sensitivity. A
 * differently spelled alias can miss coverage and taint a run, but cannot erase
 * a distinct input. Only the Windows volume root is case-normalized.
 */
function snapshotPathKey(file: string): string {
  const resolved = path.resolve(file);
  if (process.platform !== "win32") return resolved;
  const root = path.parse(resolved).root;
  return `${root.toLowerCase()}${resolved.slice(root.length)}`;
}

/** Persist the exact filesystem state one run's static key observed. */
function writeKeyBaseline(
  base: string,
  runId: string,
  inputs: Record<string, TtscWatchInputKeyBaseline>,
  staticInputs: string[],
): void {
  if (!isReusableSnapshotRunId(runId)) {
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
  if (!isReusableSnapshotRunId(runId)) {
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
      Object.values(document.inputs).some(
        (entry) => !isWatchInputKeyBaseline(entry),
      ) ||
      !Array.isArray(document.staticInputs) ||
      document.staticInputs.some(
        (entry) =>
          typeof entry !== "string" ||
          !Object.prototype.hasOwnProperty.call(document.inputs, entry),
      )
    ) {
      return undefined;
    }
    return value as KeyBaselineDocument;
  } catch {
    return undefined;
  }
}

/** Whether a run token is allowed to authorize a reusable static key. */
function isReusableSnapshotRunId(runId: string | undefined): runId is string {
  return runId !== undefined && /^[a-f0-9]{32}$/.test(runId);
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
 * The worker observations the main snapshot does not hold yet: every worker
 * file except a claimed one it names as compacted, which a removal left
 * behind.
 */
function uncompactedWorkerEntries(
  workers: SnapshotDocuments,
  main: SnapshotDocument | undefined,
): SnapshotDocument[] {
  const compacted = new Set(main?.compacted ?? []);
  return workers.entries.filter(
    (_entry, index) => !compacted.has(path.basename(workers.paths[index]!)),
  );
}

/**
 * Read every worker snapshot file in `directory`. A file that disappears
 * mid-read was renamed by a compactor, so the directory is listed again and the
 * claimed copy is read under its new name; `readable` is false when the
 * listing never settles. A file that exists but does not parse is reported in
 * `corruptPaths` so readers can degrade to a nonce and the compactor can sweep
 * it.
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
  // A name that vanishes between the listing and the read was renamed, not
  // necessarily merged: compaction claims a worker file under a new name well
  // before the merged main replaces the old one, so skipping the vanished name
  // would leave its inputs in neither place the reader looks. List again until
  // one pass reads every name it listed. The claimed copy then appears under
  // its own name, and once the merged main is published and the claimed copy
  // removed the main read that follows holds its content.
  for (let attempt = 0; attempt < SNAPSHOT_LISTING_ATTEMPTS; ++attempt) {
    const documents = readSnapshotListing(directory, prefix);
    if (documents !== undefined) {
      return documents;
    }
  }
  return { corruptPaths: [], entries: [], paths: [], readable: false };
}

/** One listing pass, or `undefined` when a listed name vanished before its read. */
function readSnapshotListing(
  directory: string,
  prefix: string,
): SnapshotDocuments | undefined {
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
      if (isMissingFileError(error)) {
        return undefined;
      }
      corruptPaths.push(file);
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
  const fileSet = new Set(Array.isArray(document.files) ? document.files : []);
  const keys = Object.keys(document).sort();
  const expectedKeys = [
    "accessibleEntries",
    "files",
    "tainted",
    "trees",
    "version",
    "volatile",
  ];
  for (const optional of ["compacted", "id"]) {
    if (Object.prototype.hasOwnProperty.call(document, optional)) {
      expectedKeys.push(optional);
    }
  }
  expectedKeys.sort();
  if (
    stableStringify(keys) !== stableStringify(expectedKeys) ||
    document.version !== SNAPSHOT_VERSION ||
    !Array.isArray(document.files) ||
    document.files.some(
      (entry) =>
        typeof entry !== "string" ||
        !(path.posix.isAbsolute(entry) || path.win32.isAbsolute(entry)),
    ) ||
    fileSet.size !== document.files.length ||
    stableStringify(document.files) !==
      stableStringify([...document.files].sort()) ||
    !Array.isArray(document.trees) ||
    document.trees.some(
      (entry) => typeof entry !== "string" || !fileSet.has(entry),
    ) ||
    new Set(document.trees).size !== document.trees.length ||
    stableStringify(document.trees) !==
      stableStringify([...document.trees].sort()) ||
    !Array.isArray(document.accessibleEntries) ||
    document.accessibleEntries.some(
      (entry) => typeof entry !== "string" || !fileSet.has(entry),
    ) ||
    new Set(document.accessibleEntries).size !==
      document.accessibleEntries.length ||
    stableStringify(document.accessibleEntries) !==
      stableStringify([...document.accessibleEntries].sort()) ||
    typeof document.tainted !== "boolean" ||
    typeof document.volatile !== "boolean" ||
    (document.id !== undefined &&
      (typeof document.id !== "string" ||
        !/^[a-f0-9]{32}$/.test(document.id))) ||
    (document.compacted !== undefined &&
      (!Array.isArray(document.compacted) ||
        document.compacted.length === 0 ||
        document.compacted.some(
          (entry) =>
            typeof entry !== "string" ||
            path.basename(entry) !== entry ||
            !isClaimedWorkerSnapshot(entry),
        ) ||
        new Set(document.compacted).size !== document.compacted.length))
  ) {
    return undefined;
  }
  return {
    accessibleEntries: document.accessibleEntries as string[],
    ...(Array.isArray(document.compacted)
      ? { compacted: document.compacted as string[] }
      : {}),
    files: document.files as string[],
    ...(typeof document.id === "string" ? { id: document.id } : {}),
    tainted: document.tainted,
    trees: document.trees as string[],
    version: SNAPSHOT_VERSION,
    volatile: document.volatile,
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
 * Represent acyclic JSON-like records with recursively sorted keys for hashing.
 * Arrays preserve order and JSON primitives use JSON escaping. This is an
 * internal key representation, not JSON for interchange.
 *
 * Undefined uses an unquoted marker and sparse array slots use a separate
 * unquoted hole marker, preserving cardinality and the distinction from null
 * and literal strings. Non-finite numbers, functions, symbols, BigInt and
 * cyclic structures are unsupported and throw rather than supplying a key.
 * Shared with the transformer's option digest.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Recursive Object.entries sorting and JSON primitive escaping provide a
 *   stable internal key representation, not another transport parser. The
 *   undefined and hole markers cannot collide with quoted string values.
 *   Array.from visits each slot, preserving length and explicit absence.
 *   Unsupported primitive values fail instead of aliasing null or absence.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One recursive encoder owns array, record and primitive representations;
 *   sorted record entries keep ordering policy in that one boundary.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Each visited value is encoded once. Each record sorts its own keys in
 *   O(k log k), and encoding space follows output bytes plus recursion depth.
 *   Sorting is necessary for insertion-order-independent record keys.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This encoder accepts potentially mutable caller records and coordinates
 *   no cross-call computation; consumers own whether encoded values can recur.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The encoder returns its owned string and retains no caller data or handle
 *   after return; temporary recursion state is computation space.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Absence is represented at its owning serializer rather than patched in
 *   individual key consumers. Unsupported primitives fail explicitly.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This operation sorts and encodes caller values for a key; it has no
 *   native path, filesystem or process boundary.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains sorted keys, the acyclic value domain,
 *   unsupported JSON interchange and explicit absence markers. Checked
 *   against the documentation skill: separate paragraphs state the contract
 *   and why its nonobvious boundary matters; field comments retain their own
 *   useful facts.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${Array.from(value, (item, index) =>
      Object.prototype.hasOwnProperty.call(value, index)
        ? stableStringify(item)
        : "hole",
    ).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  if (value === undefined) return "undefined";
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("Cannot fingerprint a non-finite number.");
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new TypeError("Cannot fingerprint an unsupported primitive value.");
  }
  return encoded;
}
