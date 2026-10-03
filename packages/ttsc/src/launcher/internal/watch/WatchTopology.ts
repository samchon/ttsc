import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { outputText } from "../../../compiler/internal/outputText";
import { readJsoncFile } from "../../../compiler/internal/project/readJsoncFile";
import { readProjectConfig } from "../../../compiler/internal/project/readProjectConfig";
import { resolveTsgo } from "../../../compiler/internal/resolveTsgo";
import { spawnNative } from "../../../compiler/internal/spawnNative";
import { normalizeCompilerEnumValue } from "../../../flags/normalizeCompilerEnumValue";
import { readCompilerOptionValues } from "../../../flags/readCompilerOptionValues";
import { type ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import { isProjectInputPathIdentityWithin } from "../../../internal/pathIdentity/isProjectInputPathIdentityWithin";
import { resolveProjectInputPath } from "../../../internal/pathIdentity/resolveProjectInputPath";
import { collectPluginSourceDirectories } from "../../../plugin/internal/source/collectPluginSourceDirectories";
import { pluginSourceCovers } from "../../../plugin/internal/source/pluginSourceCovers";
import { pluginSourceDigest } from "../../../plugin/internal/source/pluginSourceDigest";
import { prunesPluginSourceDirectory } from "../../../plugin/internal/source/prunesPluginSourceDirectory";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildOptions } from "../../../structures/internal/TtscBuildOptions";
import { resolveSingleFileOutput } from "../resolveSingleFileOutput";
import type { DirectoryWatcher } from "./DirectoryWatcher";
import { ProjectInputWatchRules } from "./ProjectInputWatchRules";
import type { WatchInputChange } from "./WatchInputChange";
import { WatchPaths } from "./WatchPaths";
import { literalGlobRoot } from "./literalGlobRoot";
import { planCompilerDirectoryWatchEvent } from "./planCompilerDirectoryWatchEvent";
import { projectInputActiveWatchDirectories } from "./projectInputActiveWatchDirectories";
import { projectInputAvailableWatchDirectory } from "./projectInputAvailableWatchDirectory";
import { projectInputEventShouldNotify } from "./projectInputEventShouldNotify";
import { projectInputMembershipInvalidatesProgram } from "./projectInputMembershipInvalidatesProgram";
import { projectInputReloadEventShouldNotify } from "./projectInputReloadEventShouldNotify";
import { projectInputReplacementStrandsWatchers } from "./projectInputReplacementStrandsWatchers";
import { projectInputTopologyMayAffect } from "./projectInputTopologyMayAffect";
import { reloadInputsForFailedTopologyRefresh } from "./reloadInputsForFailedTopologyRefresh";
import { syncWatchers } from "./syncWatchers";
import { watchDirectory } from "./watchDirectory";

/**
 * Keeps the launcher watch set aligned with the compiler's current program.
 *
 * The default compiler-input reader uses TypeScript-Go's `--listFilesOnly`
 * output for source and declaration membership. An explicit reader supplies the
 * same absolute-path membership and failure contract for each resolved project.
 * Configuration files, project-reference roots, output inference and native
 * filesystem identity remain this topology's responsibility.
 *
 * `TTSC_WATCH_DEBUG_INPUTS` reports the named event, observed population deltas
 * and reload decision. These diagnostics reuse the decision's existing inputs;
 * they perform no extra filesystem observations.
 *
 * @evidence contracts/common.md#principled-implementation The compiler-input operation's membership, published rule inputs and actual content fingerprints qualify notifications; its native default obtains the real compiler list. Post-registration reconciliation closes observation handoff gaps without treating matching territory as changed content. Explicit operations preserve native defaults without replacing global filesystem or compiler methods. Project-input attribution: Observed member deltas establish attribution; stale selected names cannot override them, while directory names retain supported population causality and unrelated multiple members remain unnamed.
 * @evidence contracts/common.md#clear-and-simple-design Compiler, plugin and project-input watch populations keep their own baselines and callbacks under one topology owner; small classifiers separate membership, selection and handle replacement. Four distinct operations own directory subscriptions, file subscriptions, immediate reload-directory reads and compiler membership; existing callers need no new argument. Project-input attribution: One private reconciliation separates member deltas from immediate resolution-directory digests before choosing a supported event name or an observed single member.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported native backends and explicit gap/replacement ownership replace foreign watcher patching; failed observation is reported rather than represented as complete coverage. The constructor manufactures no observations and bypasses no input or content proof; supplied operations retain the existing callback and result contracts. Project-input attribution: Native event names do not manufacture a delta; the current and previous physical membership identify already observed names without filename or fixture exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain membership authority, plugin fingerprinting, publication races, physical registration and public lifecycle operations following the documentation skill. Parameters identify each supplied operation and native default beside the constructor. Project-input attribution: Native paragraphs explain stale attention, directory causality, accompanying resolution digests and unselected immediate entries.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths use Node APIs and registration uses realpath; compiler/plugin maps preserve lexical aliases and fold only measured insensitive ASCII components. Project inputs use physical identities, while unknown/native Unicode relations remain conservative event candidates rather than identity proof. Registration paths and read options are passed unchanged; compiler-input readers supply absolute membership paths without replacing the topology's native identity policy. Project-input attribution: The supplied filesystem identity transaction establishes selected names and ancestry without an OS-wide case assumption or lexical alias guess.
 *
 * @evidence contracts/performance.md#efficient-algorithms Identity-keyed maps separate current membership, content baselines and handle registries; public reconciliation operations own traversal and hashing, while constructor retains operation references without an additional filesystem observation or build. Project-input attribution: R resolution-directory identities form one Set; C deltas and A distinct member ancestors require O(R+C+A) indexed visits before at most C event-ancestry comparisons. Shared ancestor keys terminate repeated walks and the supplied transaction shares native observations.
 * @evidence contracts/performance.md#reuse-equivalent-work Current membership, content baselines and live registrations belong to one topology; reconciliation owners decide their reuse against fresh premises. Supplied operation identities are retained without adding an observation-result cache or assuming changed inputs remain equivalent. Project-input attribution: This classifier borrows one scan's deltas and identity transaction without retaining cross-event answers.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Current and pending input maps belong to the topology and reconciliation retires obsolete populations; watcher registries close or rearm their acquired handles under error and shutdown ownership. Constructor acquires no handle and directory-read arrays remain call-owned. Project-input attribution: Delta arrays and keys remain call-local; the helper acquires no subscription, descriptor or retained history.
 */
export class WatchTopology {
  private analysisOnly = false;
  private closed = false;
  private compilerPostRegistrationMembershipRefresh = false;
  private compilerPostRegistrationReconciliationScheduled = false;
  private compilerPostRegistrationSkipUnobservedProjectInputWatchRoots = true;
  private directories = new Map<string, string>();
  private directoryWatchers = new Map<string, DirectoryWatcher>();
  private extraInputs: readonly string[] = [];

  /**
   * What each plugin input held when last observed, by path key: the digest a
   * plugin build keys it on (`pluginInputState`). A notification about an input
   * whose state did not move is not a plugin change.
   */
  private pluginInputStates = new Map<string, string>();

  /**
   * The plugin inputs notifications named since the last decision, by path key,
   * each with the locations noted for it (`notePluginNotification`).
   */
  private pendingPluginNotifications = new Map<string, Set<string>>();
  private pluginNotificationsScheduled = false;
  private extraWatchers = new Map<string, DirectoryWatcher>();

  /** The plugin inputs whose directories the last sync already watched. */
  private watchedExtraInputs = new Set<string>();
  private compilerFileSnapshots = new Map<string, CompilerFileSnapshot>();
  private files = new Map<string, string>();
  private lexicalIdentities = createProjectInputPathIdentityContext({
    throwOnRealpathError: false,
  });
  private fileWatchers = new Map<string, fs.FSWatcher>();
  private observedDirectories = new Map<string, string>();
  private outputFiles = new Map<string, string>();
  private outputs = new Map<string, string>();
  private projectInputFingerprints = new Map<string, string>();
  private projectInputMatches = new Map<string, string>();
  private projectInputs: ITtscProjectInputSnapshot = {
    files: [],
    globs: [],
    reloadDirectories: [],
    reloadFiles: [],
    root: "",
  };
  private declaredProjectInputs: ITtscProjectInputSnapshot = {
    files: [],
    globs: [],
    reloadDirectories: [],
    reloadFiles: [],
    root: "",
  };
  private projectInputRecoveryScheduled = false;
  private projectInputPostRegistrationReconciliationScheduled = false;
  private projectInputRejectedWatchRoots = new Set<string>();
  private projectInputRequiredWatchRoots = new Map<string, string>();
  private projectInputUnobservedWatchRoots = new Map<string, string>();
  private projectInputWatchRoots = new Map<string, string>();
  private projectInputWatchers = new Map<string, DirectoryWatcher>();
  private projectInputLinkWatchers = new Map<string, DirectoryWatcher>();
  private projectInputCompilerOutputOverlaps = new WeakMap<
    ProjectInputPathIdentityContext,
    Map<string, boolean>
  >();
  private reloadFiles = new Map<string, string>();

  /**
   * @param options What to watch.
   * @param callbacks What to tell about it.
   * @param openDirectoryWatch The backend every directory watch goes through:
   *   `watchDirectory`, which chooses the platform's, unless the caller
   *   observes the watch set through another.
   * @param openFileWatch File subscriptions use this owned observer; native
   *   fs.watch by default.
   * @param readDirectory Immediate reload-directory fingerprints use this
   *   reader; native readdirSync by default.
   * @param getCompilerInputs Read each resolved project's absolute compiler
   *   membership; the default invokes the native compiler. Readers throw
   *   listing failures and retain ownership of their returned array, which this
   *   topology does not mutate.
   */
  public constructor(
    private readonly options: WatchTopologyOptions,
    private readonly callbacks: WatchTopologyCallbacks,
    private readonly openDirectoryWatch: typeof watchDirectory = watchDirectory,
    private readonly openFileWatch: typeof fs.watch = fs.watch,
    private readonly readDirectory: typeof fs.readdirSync = fs.readdirSync,
    private readonly getCompilerInputs: typeof listCompilerInputs = listCompilerInputs,
  ) {}

  /**
   * Re-resolve compiler inputs and notify only when their membership changed.
   * Errors propagate to the caller; native watcher registration failures are
   * reported through onError while previous coverage remains live.
   *
   * @evidence contracts/common.md#principled-implementation The compiler-input operation defines membership and its native default reads the actual compiler list; new coverage is registered before stale coverage retires, and registration reconciliation compares against pre-registration baselines.
   * @evidence contracts/common.md#clear-and-simple-design One refresh delegates compiler population resolution, watcher synchronization and notification classification to separate private owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Predicted outputs never subtract from compiler-reported inputs; failed registration cannot claim complete replacement coverage.
   * @evidence contracts/common.md#meaningful-documentation Native prose states notification gating, thrown errors and registration error ownership following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Compiler processes use explicit argv/env; native APIs own path grammar and backend differences. Lexical membership uses measured component case policy, keeping unknown names and symlink aliases distinct instead of folding all Windows paths.
   * @evidence contracts/performance.md#efficient-algorithms The native compiler-input operation obtains one list per resolved project; supplied readers own their listing cost. F current inputs update indexed snapshots in linear passes. Broad reconciliation stats F files and hashes only metadata/owner movement, while named/gap events request strong reads. Windows root pruning still uses pairwise D directory containment checks.
   * @evidence contracts/performance.md#reuse-equivalent-work Existing live watchers and unchanged fingerprints are reused by key; one fresh synchronous transaction shares parent case probes across membership, output and directory keys. Registration microtasks coalesce gap work while actual compiler membership is refreshed rather than inferred from quiet notifications.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Current file snapshots prune removed members and replaced watcher populations retire handles; observed directories persist only while still relevant. Owner close retires all handle maps, and partial registration retains old coverage until reconciliation succeeds or shutdown.
   */
  public refresh(notify: boolean): void {
    this.refreshCompilerInputs(notify, false);
  }

  private refreshCompilerInputs(
    notify: boolean,
    skipUnobservedProjectInputWatchRoots: boolean,
  ): void {
    this.beginLexicalTransaction();
    const next = resolveWatchTopology(
      this.options,
      this.extraInputs,
      this.lexicalIdentities,
      this.getCompilerInputs,
    );
    const compilerProgramMembershipChange =
      next.analysisOnly &&
      WatchPaths.mapsEqual(this.reloadFiles, next.reloadFiles) &&
      WatchPaths.mapsEqual(this.outputFiles, next.outputFiles) &&
      WatchPaths.mapsEqual(this.outputs, next.outputs)
        ? compilerMembershipChange(this.files, next.files)
        : [];
    const projectInputProgramOverlap = projectInputCompilerMembershipChange(
      this.projectInputs,
      compilerProgramMembershipChange,
    );
    const projectInputProgramChange =
      compilerProgramMembershipChange.length !== 0 &&
      projectInputProgramOverlap.length ===
        compilerProgramMembershipChange.length
        ? projectInputProgramOverlap
        : undefined;
    const changed =
      this.analysisOnly !== next.analysisOnly ||
      WatchPaths.mapsEqual(this.files, next.files) === false ||
      WatchPaths.mapsEqual(this.directories, next.directories) === false ||
      WatchPaths.mapsEqual(this.outputFiles, next.outputFiles) === false ||
      WatchPaths.mapsEqual(this.outputs, next.outputs) === false ||
      WatchPaths.mapsEqual(this.reloadFiles, next.reloadFiles) === false;
    this.analysisOnly = next.analysisOnly;
    this.files = next.files;
    // Stamp the tracked set as it is resolved, so the first event that cannot
    // name what changed compares against the state the compiler just saw rather
    // than against nothing, which would make it nominate everything once.
    for (const key of [...this.compilerFileSnapshots.keys()]) {
      if (!next.files.has(key)) this.compilerFileSnapshots.delete(key);
    }
    for (const [key, file] of next.files) {
      // Only a file with no stamp yet is seeded. Restamping one that already
      // has a baseline would advance it past a change nobody reported, and the
      // next unnamed event would then read that change as no change at all.
      if (!this.compilerFileSnapshots.has(key)) {
        this.compilerFileSnapshots.set(
          key,
          compilerFileSnapshot(file, fingerprintProjectInputFile(file)),
        );
      }
    }
    this.directories = next.directories;
    this.outputFiles = next.outputFiles;
    this.outputs = next.outputs;
    this.reloadFiles = next.reloadFiles;
    const projectInputProgramReload =
      projectInputProgramOverlap.length === 0
        ? false
        : this.acknowledgeProjectInputCompilerMembership(
            projectInputProgramOverlap,
          );
    const fileWatcherRegistered = this.syncFileWatchers();
    const directoryWatcherRegistered = this.syncDirectoryWatchers();
    this.syncExtraWatchers();
    this.syncProjectInputWatchers(skipUnobservedProjectInputWatchRoots);
    if (fileWatcherRegistered || directoryWatcherRegistered) {
      this.scheduleCompilerPostRegistrationReconciliation(
        directoryWatcherRegistered,
        skipUnobservedProjectInputWatchRoots,
      );
    }
    if (notify && changed) {
      if (projectInputProgramChange !== undefined) {
        const changedPath =
          projectInputProgramChange.length === 1
            ? projectInputProgramChange[0]
            : undefined;
        this.callbacks.onInputChange(
          projectInputProgramReload
            ? { kind: "config", path: changedPath }
            : {
                invalidate: true,
                kind: "project",
                path: changedPath,
              },
        );
      } else {
        this.callbacks.onTopologyChange();
      }
    }
  }

  /**
   * Hand one Program-membership transition from the compiler lane to the
   * overlapping project-input lane.
   *
   * Windows can deliver the compiler membership refresh before the recursive
   * project watcher names the same creation. The rebuild scheduled here already
   * consumes the current project bytes, so publishing their strong fingerprints
   * keeps the later parent event from rediscovering the same population delta.
   * Compiler files keep their own content fingerprints at admission, so a
   * delayed named event for the same bytes is quiet on every backend.
   */
  private acknowledgeProjectInputCompilerMembership(
    changed: readonly string[],
  ): boolean {
    const matches = this.collectProjectInputMatches();
    const fingerprints = fingerprintProjectInputMatches(
      matches,
      this.readDirectory,
    );
    const changedInputs = projectInputChangedPaths({
      next: matches,
      nextFingerprints: fingerprints,
      previous: this.projectInputMatches,
      previousFingerprints: this.projectInputFingerprints,
    });
    const population = this.projectInputPopulation();
    const causedBy = projectInputCompilerMembershipProjectChanges(
      changed,
      population.globs,
    );
    const reloadInput = {
      causedBy,
      changed: causedBy.length === 1 ? causedBy[0] : undefined,
      changedInputs,
      globs: population.globs,
      reloadDirectories: population.reloadDirectories,
      reloadFiles: population.reloadFiles ?? [],
    };
    const reload = projectInputReloadEventShouldNotify(reloadInput);
    reportProjectInputDecision({
      source: "compiler-membership",
      ...reloadInput,
      reload,
    });
    // The callback below consumes the complete population observed by this
    // scan. Crucially, reload classification runs against the old baseline
    // first, so a concurrent selection delta becomes one cold transition
    // instead of disappearing behind the warm compiler-membership handoff.
    this.projectInputMatches = matches;
    this.projectInputFingerprints = fingerprints;
    return reload;
  }

  /**
   * Add Go plugin source trees discovered by the real build lane. Existing
   * input fingerprints retain their baseline; new inputs are captured before
   * the caller builds them, so subsequent changes cannot disappear.
   *
   * @evidence contracts/common.md#principled-implementation Published plugin inputs define the source corpus, and retaining existing pre-build baselines keeps unreported edits visible.
   * @evidence contracts/common.md#clear-and-simple-design Deduplication, baseline retention and compiler/watch reconciliation remain ordered phases.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual plugin source digest excludes only build-owned pruned trees; named plugins or fixture output do not replace consumed-input evidence.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains baseline timing and why existing inputs are not restamped following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and canonical backend registration govern source trees; lexical keys preserve declarations and unknown names, folding ASCII only under measured insensitive parents rather than an OS-derived rule.
   * @evidence contracts/performance.md#efficient-algorithms I input keys are deduplicated once; only newly admitted inputs compute initial source digests. Source-directory enumeration follows the plugin build's actual pruned corpus, with indexed watcher reuse during reconciliation.
   * @evidence contracts/performance.md#reuse-equivalent-work Unchanged ordered input sets return immediately; existing inputs reuse their recorded digest until actual notification processing establishes changed consumed state.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each publication replaces input/digest populations and case-observation caches; obsolete native source watchers close during synchronization and owner shutdown releases remaining handles and the last transaction's observations.
   */
  public setExtraInputs(inputs: readonly string[]): void {
    this.beginLexicalTransaction();
    const next = uniqueExistingPaths(inputs, this.lexicalIdentities);
    if (arraysEqual(this.extraInputs, next)) return;
    this.extraInputs = next;
    // The load reports its inputs before any build reads them, so the state
    // recorded here precedes every read, and an edit after it moves the state.
    // An input already tracked keeps its baseline: restamping it would absorb
    // a change nobody reported.
    const states = new Map<string, string>();
    for (const input of next) {
      const key = this.pathKey(input);
      states.set(
        key,
        this.pluginInputStates.get(key) ?? pluginInputState(input),
      );
    }
    this.pluginInputStates = states;
    this.refresh(false);
  }

  /**
   * Reconcile project-rule dependencies, retaining absent files and empty glob
   * populations as live topology.
   *
   * @evidence contracts/common.md#principled-implementation Both lexical declarations and current physical identities remain observable, including missing members and empty globs; republication can update aliased watcher ownership without requiring population movement.
   * @evidence contracts/common.md#clear-and-simple-design Publication normalization, baseline population capture and root synchronization are separate stages, with one retained declaration-owner map.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing inputs are not dropped from observation, and an unavailable safe root is reported rather than widened over a system ancestor.
   * @evidence contracts/common.md#meaningful-documentation Native prose and helper paragraphs explain absent populations, aliases, handoff reconciliation and root ceilings following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Transaction-owned native case observations and physical identities distinguish resolved aliases; unknown case routes both glob interpretations without merging keys, while canonical registration and separate link-entry observation preserve retargets.
   * @evidence contracts/performance.md#efficient-algorithms D declarations normalize once per publication; physical glob roots deduplicate and covered descendants join one ancestor traversal, so each admitted tree is enumerated once. Matching F visited files against G applicable patterns remains O(FG) predicate work, while fingerprints read selected byte/member state once per final identity.
   * @evidence contracts/performance.md#reuse-equivalent-work Equal normalized publications reuse content baselines but still reconcile lexical aliases; registration microtasks coalesce equivalent handoff work, and transaction indexes reuse identity and output-overlap decisions within one scan.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Publication prunes retired declaration-owner choices and replaces match/fingerprint populations; watcher retirement and close release native handles. Transaction output-overlap caches use weak identity-context keys, so old transactions are not retained.
   */
  public setProjectInputs(inputs: ITtscProjectInputSnapshot): void {
    const next = normalizeProjectInputSnapshot(inputs);
    // The declared spellings are recorded even when the normalized snapshot did
    // not move, because a republication can carry a new alias for identities
    // that already matched, and anchoring the spelling that was retired would
    // leave the live one unwatched.
    this.declaredProjectInputs =
      inputs.declared === undefined
        ? inputs
        : { ...inputs.declared, root: inputs.root };
    if (projectInputSnapshotsEqual(this.projectInputs, next)) {
      this.syncProjectInputWatchers();
      return;
    }
    this.projectInputs = next;
    this.projectInputRejectedWatchRoots.clear();
    this.pruneProjectInputWatchRoots([
      next,
      inputs,
      { ...(inputs.declared ?? inputs), root: inputs.root },
    ]);
    this.projectInputMatches = this.collectProjectInputMatches();
    this.projectInputFingerprints = fingerprintProjectInputMatches(
      this.projectInputMatches,
      this.readDirectory,
    );
    this.syncProjectInputWatchers();
  }

  /**
   * Close every watcher so SIGINT/SIGTERM can drain the event loop. Scheduled
   * reconciliation callbacks observe the closed state and retire without
   * creating replacement subscriptions.
   *
   * @evidence contracts/common.md#principled-implementation Marking the owner closed before retiring subscriptions prevents queued reconciliations from reopening native handles.
   * @evidence contracts/common.md#clear-and-simple-design One shutdown operation closes and clears each distinct watcher population through a shared helper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Shutdown retires actual owned subscriptions rather than only suppressing future output callbacks.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain event-loop release and queued-work behavior following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Shared close methods retire both Node handles and macOS registry subscriptions without exposing native handle types.
   * @evidence contracts/performance.md#efficient-algorithms Every owned watcher is closed once per live-map traversal, O(W) for W subscriptions, and cleared maps make repeated closure empty.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Shutdown decides no equivalence of compilation or fingerprint work.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources All five native watcher maps are cleared and the last lexical transaction is replaced with an empty one; queued tasks stop through the closed guard. Snapshot/declaration byte state remains until the caller releases the facade, rather than claiming close frees every retained byte.
   */
  public close(): void {
    this.closed = true;
    closeWatchers(this.fileWatchers);
    closeWatchers(this.directoryWatchers);
    closeWatchers(this.extraWatchers);
    closeWatchers(this.projectInputWatchers);
    closeWatchers(this.projectInputLinkWatchers);
    this.beginLexicalTransaction();
  }

  /** Start fresh native case observations for one synchronous watch decision. */
  private beginLexicalTransaction(): void {
    this.lexicalIdentities = createProjectInputPathIdentityContext({
      throwOnRealpathError: false,
    });
  }

  /** Keep lexical alias ownership while sharing this decision's case probes. */
  private pathKey(location: string): string {
    return WatchPaths.pathKey(location, this.lexicalIdentities);
  }

  private syncFileWatchers(skipMissing = false): boolean {
    const previous = new Map(this.fileWatchers);
    const files =
      process.platform === "win32"
        ? new Map<string, string>()
        : skipMissing
          ? new Map(
              [...this.files].filter(([, location]) => fs.existsSync(location)),
            )
          : this.files;
    syncWatchers(
      this.fileWatchers,
      files,
      (location) =>
        this.openFileWatch(
          watcherRegistrationPath(location),
          { persistent: true },
          () => {
            this.beginLexicalTransaction();
            // A per-file watcher fires on any filesystem attention its target
            // receives, and it carries no filename to distinguish an edit from
            // a touch. It answers the same question the unnamed directory event
            // answers, so it answers it the same way: from the bytes.
            const movement = this.compilerFileMovement(location, true);
            if (movement.owner) this.rearmFileWatchers([location], true);
            if (!this.compilerMovementReports(location, movement)) return;
            this.reportCompilerFileChange(location);
          },
        ),
      (location, error) => this.callbacks.onError(location, error),
      () => this.closed === false,
    );
    return [...this.fileWatchers].some(
      ([key, watcher]) => previous.get(key) !== watcher,
    );
  }

  /**
   * Compare a tracked file with its last observed bytes and physical owner.
   *
   * A named event or observation gap reads the bytes even when time and size
   * stayed still. A broad registration scan reads only a file whose metadata or
   * owner moved, so an unrelated event does not read the whole Program.
   */
  private compilerFileMovement(
    location: string,
    strong = false,
  ): CompilerFileMovement {
    const key = this.pathKey(location);
    const previous = this.compilerFileSnapshots.get(key);
    const metadata = compilerFileSnapshot(location, "");
    const read =
      strong ||
      previous === undefined ||
      previous.content !== metadata.content ||
      previous.owner !== metadata.owner;
    const fingerprint = read
      ? fingerprintProjectInputFile(location)
      : (previous?.fingerprint ?? "");
    this.compilerFileSnapshots.set(key, { ...metadata, fingerprint });
    return {
      content:
        previous === undefined
          ? fingerprint !== ""
          : previous.fingerprint !== fingerprint,
      owner: previous?.owner !== metadata.owner,
    };
  }

  /** A config's physical replacement can change resolution with equal bytes. */
  private compilerMovementReports(
    location: string,
    movement: CompilerFileMovement,
  ): boolean {
    return (
      movement.content ||
      (movement.owner && this.classifyCompilerInput(location) === "config")
    );
  }

  private syncDirectoryWatchers(): boolean {
    const previous = new Map(this.directoryWatchers);
    const desired = new Map(this.directories);
    for (const [key, location] of this.observedDirectories) {
      if (
        WatchPaths.isDirectory(location) === false ||
        this.isCompilerOutputDirectory(location) ||
        this.isProjectInputDirectory(location)
      ) {
        this.observedDirectories.delete(key);
        continue;
      }
      desired.set(key, location);
    }
    if (process.platform === "win32") {
      for (const [key, location] of desired) {
        if (
          [...desired].some(
            ([candidateKey, candidate]) =>
              candidateKey !== key &&
              WatchPaths.isPathWithin(
                candidate,
                location,
                this.lexicalIdentities,
              ),
          )
        ) {
          desired.delete(key);
        }
      }
    }
    syncWatchers(
      this.directoryWatchers,
      desired,
      (location) =>
        this.openDirectoryWatch(
          watcherRegistrationPath(location),
          process.platform === "win32",
          (event, filename, gap) => {
            this.beginLexicalTransaction();
            const changed =
              filename === null ? undefined : path.resolve(location, filename);
            const pluginInput = changed ?? location;
            if (this.isPluginInput(pluginInput)) {
              this.notePluginNotification(pluginInput);
              return;
            }
            const plan = planCompilerDirectoryWatchEvent({
              changed,
              event,
              exists: fs.existsSync,
              location,
              identities: this.lexicalIdentities,
              platform: process.platform,
              trackedFiles: this.files,
            });
            this.rearmFileWatchers(plan.rearm);
            for (const file of this.compilerChangesToReport(
              plan.changes,
              changed,
              gap === true,
            )) {
              this.reportCompilerFileChange(file);
            }
            if (plan.refresh) this.refreshFromDirectory(location, changed);
          },
        ),
      (location, error) => this.callbacks.onError(location, error),
      () => this.closed === false,
    );
    return [...this.directoryWatchers].some(
      ([key, watcher]) => previous.get(key) !== watcher,
    );
  }

  /**
   * Reconcile tracked compiler files after a newly registered watcher returns.
   *
   * A file or directory watcher can be returned before its backend is ready to
   * deliver the first event. The compiler-file stamps were captured before
   * registration, so one coalesced microtask can recover a change in that
   * handoff window. A real event updates the same stamp first and makes this
   * bounded scan a no-op.
   */
  private scheduleCompilerPostRegistrationReconciliation(
    refreshMembership: boolean,
    skipUnobservedProjectInputWatchRoots: boolean,
  ): void {
    if (this.closed) return;
    if (refreshMembership) {
      this.compilerPostRegistrationMembershipRefresh = true;
      this.compilerPostRegistrationSkipUnobservedProjectInputWatchRoots =
        this.compilerPostRegistrationSkipUnobservedProjectInputWatchRoots &&
        skipUnobservedProjectInputWatchRoots;
    }
    if (this.compilerPostRegistrationReconciliationScheduled) return;
    this.compilerPostRegistrationReconciliationScheduled = true;
    queueMicrotask(() => {
      this.compilerPostRegistrationReconciliationScheduled = false;
      if (this.closed) return;
      this.beginLexicalTransaction();
      const refreshCompilerMembership =
        this.compilerPostRegistrationMembershipRefresh;
      const skipUnobservedProjectInputWatchRoots =
        this.compilerPostRegistrationSkipUnobservedProjectInputWatchRoots;
      this.compilerPostRegistrationMembershipRefresh = false;
      this.compilerPostRegistrationSkipUnobservedProjectInputWatchRoots = true;

      const changed: string[] = [];
      const rearm: string[] = [];
      for (const file of this.files.values()) {
        const movement = this.compilerFileMovement(file);
        if (this.compilerMovementReports(file, movement)) changed.push(file);
        if (movement.owner) rearm.push(file);
      }
      // A replacement can move the path to a new inode without changing its
      // bytes. Rebind an ordinary source without inventing a content change;
      // report a config owner transition because it can change resolution.
      // Missing entries remain covered by their parent directory.
      this.rearmFileWatchers(rearm, true);
      for (const file of changed) {
        this.reportCompilerFileChange(file);
      }
      if (!refreshCompilerMembership) return;
      try {
        // Directory watchers own files not present in the current Program.
        // Re-resolve even when every tracked stamp is unchanged so a swallowed
        // startup event cannot strand a newly included source.
        this.refreshCompilerInputs(true, skipUnobservedProjectInputWatchRoots);
      } catch (error) {
        const reported = new Set(changed.map((file) => this.pathKey(file)));
        const reconciledChange = changed.length === 1 ? changed[0]! : undefined;
        for (const reload of reloadInputsForFailedTopologyRefresh(
          this.reloadFiles.values(),
          reconciledChange,
          this.lexicalIdentities,
        )) {
          if (reported.has(this.pathKey(reload))) continue;
          this.callbacks.onInputChange({ kind: "config", path: reload });
        }
        this.callbacks.onError(
          reconciledChange === undefined
            ? (this.options.projectRoot ?? this.options.cwd)
            : path.dirname(reconciledChange),
          error,
        );
      }
    });
  }

  /**
   * Narrow a plan's changes to tracked files whose bytes actually moved.
   *
   * A named event checks its file even when time and size stayed still. A gap
   * can hide such a rewrite anywhere under the watched root, so every candidate
   * gets a strong check. Ordinary broad scans still use metadata first.
   */
  private compilerChangesToReport(
    changes: readonly string[],
    changed: string | undefined,
    gap: boolean,
  ): string[] {
    return changes.filter((file) => {
      const movement = this.compilerFileMovement(
        file,
        changed !== undefined || gap,
      );
      return this.compilerMovementReports(file, movement);
    });
  }

  /**
   * Let a selected project input consume its compiler content notification.
   * Both lanes watch a resolveJsonModule file, but its project fingerprint
   * decides the resident update once whichever backend hears the edit first. A
   * missing compiler member instead reconciles Program membership before a
   * stale file-watch notification can schedule a second build.
   */
  private reportCompilerFileChange(location: string): void {
    if (this.classifyCompilerInput(location) === "compiler") {
      if (fs.existsSync(location)) {
        if (this.projectInputMatches.size !== 0) {
          const key = createProjectInputPathIdentityContext({
            throwOnRealpathError: false,
          }).resolve(location).key;
          if (
            this.projectInputMatches.has(key) &&
            this.refreshProjectInputs(path.dirname(location), location)
          )
            return;
        }
      } else {
        this.refreshFromDirectory(path.dirname(location), location);
        if (!this.files.has(this.pathKey(location))) return;
      }
    }
    this.callbacks.onInputChange({
      kind: this.classifyCompilerInput(location),
      path: location,
    });
  }

  private rearmFileWatchers(
    files: readonly string[],
    skipMissing = false,
  ): void {
    for (const file of files) {
      const key = this.pathKey(file);
      const watcher = this.fileWatchers.get(key);
      if (watcher === undefined) continue;
      watcher.close();
      this.fileWatchers.delete(key);
    }
    if (this.syncFileWatchers(skipMissing)) {
      this.scheduleCompilerPostRegistrationReconciliation(false, true);
    }
  }

  /**
   * Watch every directory of every plugin input, and report what a directory
   * that appeared below an input already watched holds by now.
   *
   * Each directory has a watcher of its own, and a directory created below a
   * plugin module is heard through its parent's; its own watcher is added only
   * here, when that notification is decided (`decidePluginNotifications`) or
   * the topology refreshes. A file written into it in between reaches no
   * watcher on a platform whose watcher reports a directory's direct entries
   * alone, and a build may have read the directory before the file landed. So
   * once its watcher is registered, each entry it holds is noted as a plugin
   * notification, as `@ttsc/unplugin`'s observer announces a directory it
   * starts watching, and reported when it moved what a build reads. The
   * directories of an input new to this sync are not reported: the load reports
   * its inputs before any build reads them.
   */
  private syncExtraWatchers(): void {
    const directories = new Map<string, string>();
    const appeared: string[] = [];
    for (const input of this.extraInputs) {
      const watchedBefore = this.watchedExtraInputs.has(this.pathKey(input));
      for (const directory of collectInputDirectories(input)) {
        const key = this.pathKey(directory);
        directories.set(key, directory);
        if (watchedBefore && !this.extraWatchers.has(key)) {
          appeared.push(directory);
        }
      }
    }
    syncWatchers(
      this.extraWatchers,
      directories,
      (location) =>
        this.openDirectoryWatch(
          watcherRegistrationPath(location),
          false,
          (_event, filename) => {
            this.beginLexicalTransaction();
            const changed =
              filename === null ? undefined : path.resolve(location, filename);
            // The one decision every watcher that hears a plugin path shares;
            // here it drops the entry of a directory the build passes over.
            if (changed !== undefined && !this.isPluginInput(changed)) return;
            this.notePluginNotification(changed ?? location);
          },
        ),
      (location, error) => this.callbacks.onError(location, error),
      () => this.closed === false,
    );
    this.watchedExtraInputs = new Set(
      this.extraInputs.map((input) => this.pathKey(input)),
    );
    for (const directory of appeared) {
      // Only a directory now watched: one whose registration failed was
      // reported through `onError`, and one gone meanwhile holds nothing.
      if (!this.extraWatchers.has(this.pathKey(directory))) continue;
      let entries: string[];
      try {
        entries = fs.readdirSync(directory);
      } catch {
        continue;
      }
      for (const name of entries) {
        const entry = path.join(directory, name);
        if (this.isPluginInput(entry)) this.notePluginNotification(entry);
      }
    }
  }

  private syncProjectInputWatchers(
    skipUnobservedProjectInputWatchRoots = false,
  ): void {
    if (this.closed) return;
    const previous = new Map(this.projectInputWatchers);
    const previousLinks = new Map(this.projectInputLinkWatchers);
    const identities = createProjectInputPathIdentityContext();
    const desired = new Map<string, string>();
    const required = new Map<string, string>();
    for (const file of this.projectInputDeclarations("file")) {
      if (this.isProjectInputCompilerOutput(file, identities)) continue;
      const location = this.projectInputWatchRoot(
        "file",
        file,
        path.dirname(file),
      );
      this.retainProjectInputWatchRoot(
        required,
        desired,
        identities,
        location,
        path.dirname(file),
        skipUnobservedProjectInputWatchRoots,
      );
    }
    for (const glob of this.projectInputDeclarations("glob")) {
      const root = literalGlobRoot(glob);
      if (this.isProjectInputCompilerOutputDirectory(root, identities)) {
        continue;
      }
      const location = this.projectInputWatchRoot("glob", glob, root);
      this.retainProjectInputWatchRoot(
        required,
        desired,
        identities,
        location,
        root,
        skipUnobservedProjectInputWatchRoots,
      );
    }
    for (const file of this.projectInputDeclarations("reload")) {
      if (this.isProjectInputCompilerOutput(file, identities)) continue;
      const location = this.projectInputWatchRoot(
        "reload",
        file,
        path.dirname(file),
      );
      this.retainProjectInputWatchRoot(
        required,
        desired,
        identities,
        location,
        path.dirname(file),
        skipUnobservedProjectInputWatchRoots,
      );
    }
    for (const directory of this.projectInputDeclarations("reload-directory")) {
      if (this.isProjectInputCompilerOutputDirectory(directory, identities)) {
        continue;
      }
      const location = this.projectInputWatchRoot(
        "reload-directory",
        directory,
        directory,
      );
      this.retainProjectInputWatchRoot(
        required,
        desired,
        identities,
        location,
        directory,
        skipUnobservedProjectInputWatchRoots,
      );
    }
    const active = new Map<string, string>();
    for (const location of projectInputActiveWatchDirectories(
      desired.values(),
      identities,
    )) {
      const identity = identities.resolve(location);
      active.set(identity.key, identity.path);
    }
    this.projectInputRequiredWatchRoots = required;
    syncWatchers(
      this.projectInputWatchers,
      active,
      (location) =>
        this.openDirectoryWatch(
          watcherRegistrationPath(location),
          true,
          (_event, filename) => {
            const changed =
              filename === null ? undefined : path.resolve(location, filename);
            this.refreshProjectInputs(location, changed);
          },
        ),
      (location, error) => {
        const key = identities.resolve(location).key;
        const firstFailure = !this.projectInputRejectedWatchRoots.has(key);
        this.projectInputRejectedWatchRoots.add(key);
        this.callbacks.onError(location, error);
        if (firstFailure && !this.closed) {
          this.scheduleProjectInputWatcherRecovery();
        }
      },
      () => this.closed === false,
    );
    if (this.closed) return;
    if (!this.projectInputRecoveryScheduled) {
      this.reportUnobservedProjectInputWatchRoots(required);
    }
    this.syncProjectInputLinkWatchers(identities);
    const watcherRegistered =
      [...this.projectInputWatchers].some(
        ([key, watcher]) => previous.get(key) !== watcher,
      ) ||
      [...this.projectInputLinkWatchers].some(
        ([key, watcher]) => previousLinks.get(key) !== watcher,
      );
    if (watcherRegistered) {
      this.scheduleProjectInputPostRegistrationReconciliation();
    }
    this.callbacks.onProjectInputWatchRoots?.(
      [...this.projectInputWatchers.keys()]
        .map((key) => active.get(key) ?? identities.resolve(key).path)
        .sort(),
    );
  }

  /**
   * Watch the directory that holds a declaration which is itself a link.
   *
   * A recursive watcher cannot report the link being replaced. The backend that
   * keys its handles by path skips an entry it already knows, and the handle it
   * put on the entry followed the link to the target's inode, which unlinking
   * and recreating the link never touches. A plain directory watch has neither
   * property: it reports the entry by name the moment it moves. These are kept
   * apart from the recursive roots because they are not roots — they observe
   * one directory, they are never reported as watch roots, and an ancestor
   * covering them does not make them redundant.
   */
  private syncProjectInputLinkWatchers(
    identities: ProjectInputPathIdentityContext,
  ): void {
    const desired = new Map<string, string>();
    for (const kind of ["file", "reload"] as const) {
      for (const declaration of this.projectInputDeclarations(kind)) {
        const declared = path.resolve(declaration);
        // The test is whether the declaration is itself a link, not whether its
        // spelling is canonical. Comparing against the resolved identity would
        // admit every declaration whose ancestor is aliased — which on macOS is
        // every declaration under the system temporary directory — and it would
        // still miss the retarget, because the watcher goes below the link.
        if (!isSymbolicLink(declared)) continue;
        if (this.isProjectInputCompilerOutput(declared, identities)) continue;
        const parent = WatchPaths.nearestExistingDirectory(
          path.dirname(declared),
        );
        if (parent === undefined) continue;
        desired.set(identities.resolve(parent).key, parent);
      }
    }
    syncWatchers(
      this.projectInputLinkWatchers,
      desired,
      (location) =>
        this.openDirectoryWatch(
          watcherRegistrationPath(location),
          false,
          (_event, filename) => {
            const changed =
              filename === null ? undefined : path.resolve(location, filename);
            this.refreshProjectInputs(location, changed);
          },
        ),
      (location, error) => this.callbacks.onError(location, error),
      () => this.closed === false,
    );
  }

  /** Drop the watcher that just reported a directory replacement. */
  private retireProjectInputWatcher(
    location: string,
    identities: ProjectInputPathIdentityContext,
  ): void {
    const key = identities.resolve(location).key;
    // A plain directory watcher binds an inode, so a replacement strands it
    // exactly as it strands a recursive root. Both maps are keyed the same way,
    // so both are retired together and the next sync reinstalls whichever the
    // declarations still call for.
    for (const watchers of [
      this.projectInputWatchers,
      this.projectInputLinkWatchers,
    ]) {
      const watcher = watchers.get(key);
      if (watcher === undefined) continue;
      watcher.close();
      watchers.delete(key);
    }
  }

  private retainProjectInputWatchRoot(
    required: Map<string, string>,
    desired: Map<string, string>,
    identities: ProjectInputPathIdentityContext,
    location: string | undefined,
    target: string,
    skipUnobservedProjectInputWatchRoots: boolean,
  ): void {
    const requiredIdentity = identities.resolve(location ?? target);
    required.set(requiredIdentity.key, requiredIdentity.path);
    if (skipUnobservedProjectInputWatchRoots) {
      const retainedActiveRoot = [...this.projectInputWatchers.keys()].find(
        (root) => isProjectInputPathIdentityWithin(root, requiredIdentity.key),
      );
      if (retainedActiveRoot !== undefined) {
        desired.set(retainedActiveRoot, retainedActiveRoot);
        return;
      }
    }
    if (
      location === undefined ||
      (skipUnobservedProjectInputWatchRoots &&
        this.projectInputUnobservedWatchRoots.has(requiredIdentity.key))
    ) {
      return;
    }
    const available = projectInputAvailableWatchDirectory(
      location,
      this.projectInputRejectedWatchRoots,
      identities,
      this.projectInputs.root,
    );
    if (available === undefined) return;
    const identity = identities.resolve(available);
    desired.set(identity.key, identity.path);
  }

  /**
   * Retry a failed root on the next reconciliation instead of retiring it for
   * the session.
   *
   * This immediate recovery pass still honors the rejected root so it can
   * install a safe ancestor where one exists. Only the recovery fixpoint
   * reports a genuinely uncovered lane; transient gaps between fallback
   * candidates are not user-visible. The rejection then expires. A later
   * compiler refresh or an unchanged project-input republication can retry the
   * original root, while a permanently failing backend costs at most one
   * attempt per sync.
   */
  private scheduleProjectInputWatcherRecovery(): void {
    if (this.projectInputRecoveryScheduled) return;
    this.projectInputRecoveryScheduled = true;
    queueMicrotask(() => {
      try {
        let previousRejectionCount = -1;
        while (
          this.closed === false &&
          previousRejectionCount !== this.projectInputRejectedWatchRoots.size
        ) {
          previousRejectionCount = this.projectInputRejectedWatchRoots.size;
          this.syncProjectInputWatchers();
        }
      } finally {
        this.projectInputRejectedWatchRoots.clear();
        this.projectInputRecoveryScheduled = false;
        if (!this.closed) {
          this.reportUnobservedProjectInputWatchRoots(
            this.projectInputRequiredWatchRoots,
          );
        }
      }
    });
  }

  /**
   * Reconcile the snapshot-to-watcher handoff after the caller's current turn.
   *
   * A recursive watcher can return before its backend is ready to deliver the
   * first event. The publication baseline is necessarily captured before that
   * watcher exists, so an input materialized synchronously after
   * `setProjectInputs()` would otherwise depend entirely on that startup event.
   * The ordinary fingerprint update makes this scan and a real backend event
   * race safely: whichever arrives first records the new population and the
   * other becomes a no-op.
   */
  private scheduleProjectInputPostRegistrationReconciliation(): void {
    if (
      this.closed ||
      this.projectInputPostRegistrationReconciliationScheduled
    ) {
      return;
    }
    this.projectInputPostRegistrationReconciliationScheduled = true;
    queueMicrotask(() => {
      this.projectInputPostRegistrationReconciliationScheduled = false;
      if (this.closed) return;
      this.refreshPublishedProjectInputIdentities();
      this.refreshProjectInputs(this.projectInputs.root, undefined, true);
    });
  }

  /**
   * Re-resolve declarations after watcher registration.
   *
   * A missing path can become a symlink before the handoff scan. The retained
   * normalized snapshot still names the pre-link spelling in that case, so a
   * scan can find the first target file without installing the physical owner
   * that must observe later target changes.
   */
  private refreshPublishedProjectInputIdentities(): void {
    const next = normalizeProjectInputSnapshot(this.declaredProjectInputs);
    if (projectInputSnapshotsEqual(this.projectInputs, next)) return;
    this.projectInputs = next;
    this.pruneProjectInputWatchRoots([next, this.declaredProjectInputs]);
  }

  /** Drop retained owner choices for declarations no longer published. */
  private pruneProjectInputWatchRoots(
    snapshots: readonly ITtscProjectInputSnapshot[],
  ): void {
    const declarations = new Set(
      snapshots.flatMap((snapshot) => [
        ...snapshot.files.map((file) =>
          projectInputDeclarationKey("file", file),
        ),
        ...snapshot.globs.map((glob) =>
          projectInputDeclarationKey("glob", glob),
        ),
        ...(snapshot.reloadFiles ?? []).map((file) =>
          projectInputDeclarationKey("reload", file),
        ),
        ...(snapshot.reloadDirectories ?? []).map((directory) =>
          projectInputDeclarationKey("reload-directory", directory),
        ),
      ]),
    );
    for (const key of this.projectInputWatchRoots.keys()) {
      if (!declarations.has(key)) this.projectInputWatchRoots.delete(key);
    }
  }

  /** Report only newly uncovered project-input roots as an observation loss. */
  private reportUnobservedProjectInputWatchRoots(
    required: ReadonlyMap<string, string>,
  ): void {
    const active = [...this.projectInputWatchers.keys()];
    const unavailable = new Map(
      [...required].filter(([key]) =>
        active.every((root) => !isProjectInputPathIdentityWithin(root, key)),
      ),
    );
    const newlyUnavailable = [...unavailable]
      .filter(([key]) => !this.projectInputUnobservedWatchRoots.has(key))
      .map(([, location]) => location)
      .sort();
    this.projectInputUnobservedWatchRoots = unavailable;
    if (newlyUnavailable.length !== 0) {
      this.callbacks.onProjectInputWatchUnavailable?.(newlyUnavailable);
    }
  }

  /**
   * One snapshot holding every spelling of every declaration.
   *
   * Consumers that decide from a population rather than from a single path have
   * to see both, or half of them answer from the file a link pointed at when
   * the snapshot was published while the event they are judging resolved to the
   * file it points at now.
   */
  private projectInputPopulation(): ITtscProjectInputSnapshot {
    return {
      files: this.projectInputDeclarations("file"),
      globs: this.projectInputDeclarations("glob"),
      reloadDirectories: this.projectInputDeclarations("reload-directory"),
      reloadFiles: this.projectInputDeclarations("reload"),
      root: this.projectInputs.root,
    };
  }

  /**
   * Every spelling of one declaration that has to be anchored separately.
   *
   * The retained snapshot is normalized to physical identities, which is what
   * every comparison needs but not what every watcher needs: a declaration
   * reached through a symlink resolves to its target's directory, so anchoring
   * the normalized form alone watches the bytes and never the link. Retargeting
   * or replacing the link then goes unobserved, even though it is exactly what
   * decides which bytes the declaration names next. Both spellings are planned
   * through the same root selection, so the project-root hoist and the
   * nearest-existing-ancestor boundary still bound each of them, and the active
   * set drops one again whenever they coincide or share an ancestor.
   */
  private projectInputDeclarations(
    kind: "file" | "glob" | "reload" | "reload-directory",
  ): string[] {
    const select = (snapshot: ITtscProjectInputSnapshot): readonly string[] =>
      kind === "file"
        ? snapshot.files
        : kind === "glob"
          ? snapshot.globs
          : kind === "reload"
            ? (snapshot.reloadFiles ?? [])
            : (snapshot.reloadDirectories ?? []);
    const seen = new Set<string>();
    const declarations: string[] = [];
    for (const entry of [
      ...select(this.projectInputs),
      ...select(this.declaredProjectInputs),
    ]) {
      const key = resolveProjectInputPath(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      declarations.push(entry);
    }
    return declarations;
  }

  private projectInputWatchRoot(
    kind: "file" | "glob" | "reload" | "reload-directory",
    declaration: string,
    target: string,
  ): string | undefined {
    const key = projectInputDeclarationKey(kind, declaration);
    const retained = this.projectInputWatchRoots.get(key);
    if (retained !== undefined && WatchPaths.isDirectory(retained))
      return retained;
    const resolved = ProjectInputWatchRules.projectInputRecursiveWatchRoot(
      target,
      this.projectInputs.root,
    );
    if (resolved !== undefined) this.projectInputWatchRoots.set(key, resolved);
    return resolved;
  }

  private refreshProjectInputs(
    location: string,
    changed?: string,
    skipUnobservedProjectInputWatchRoots = false,
  ): boolean {
    this.beginLexicalTransaction();
    try {
      const previous = this.projectInputMatches;
      const identities = createProjectInputPathIdentityContext();
      // One population for the whole decision. Every question below is asked of
      // the same declarations, and rebuilding it per question would both cost
      // more and let two answers disagree about what was declared.
      const population = this.projectInputPopulation();
      const directlyMatched =
        changed !== undefined &&
        (previous.has(identities.resolve(changed).key) ||
          matchesProjectInput(population, changed, identities));
      const topologyMatched =
        changed !== undefined &&
        projectInputTopologyMayAffect(
          population,
          changed,
          previous,
          identities,
        );
      if (
        changed !== undefined &&
        (this.isProjectInputCompilerOutput(changed, identities) ||
          (directlyMatched === false && topologyMatched === false))
      ) {
        return false;
      }
      // Rearm before snapshotting. A watcher that has to be replaced stops
      // delivering the moment it is closed, so a scan taken first would become
      // the baseline for a window in which nothing was watched, and anything
      // written there would never be announced again. Reinstalling first makes
      // the scan below observe whatever the gap swallowed.
      if (
        changed !== undefined &&
        projectInputReplacementStrandsWatchers(population, changed, identities)
      ) {
        this.retireProjectInputWatcher(location, identities);
        this.syncProjectInputWatchers();
      }
      const next = this.collectProjectInputMatches();
      const membershipChanged = WatchPaths.mapsEqual(previous, next) === false;
      const nextFingerprints =
        changed === undefined ||
        membershipChanged ||
        directlyMatched ||
        topologyMatched
          ? fingerprintProjectInputMatches(next, this.readDirectory)
          : this.projectInputFingerprints;
      const contentChanged =
        WatchPaths.mapsEqual(
          this.projectInputFingerprints,
          nextFingerprints,
        ) === false;
      const changedInputs = projectInputChangedPaths({
        next,
        nextFingerprints,
        previous,
        previousFingerprints: this.projectInputFingerprints,
      });
      const reconciledChange = reconcileProjectInputChange({
        changed,
        changedInputs,
        identities,
        next,
        previous,
        reloadDirectories: population.reloadDirectories ?? [],
      });
      // Both spellings classify the event. The normalized form names the file a
      // link pointed at when the snapshot was published, so after a retarget it
      // names the wrong one; only the declared form resolves to what the link
      // points at now, which is the selection this lane exists to protect.
      const reloadInput = {
        changed: reconciledChange,
        changedInputs,
        globs: population.globs,
        reloadDirectories: population.reloadDirectories ?? [],
        reloadFiles: population.reloadFiles ?? [],
      };
      const reload = projectInputReloadEventShouldNotify(reloadInput);
      const invalidate = projectInputMembershipInvalidatesProgram({
        changed: reconciledChange,
        changedInputs,
        contentChanged,
        next,
        previous,
      });
      this.projectInputMatches = next;
      this.projectInputFingerprints = nextFingerprints;
      this.syncProjectInputWatchers(skipUnobservedProjectInputWatchRoots);
      // A JSON/TS/JS project-input member can simultaneously enter or leave
      // the compiler Program. Reconcile the compiler watch snapshot before
      // scheduling its resident invalidation, so runWatch's post-cycle refresh
      // does not rediscover the same delta as a broader execution reload.
      if (invalidate) {
        this.refreshCompilerInputs(false, skipUnobservedProjectInputWatchRoots);
      }
      const notify =
        projectInputEventShouldNotify({
          contentChanged,
          directlyMatched,
          membershipChanged,
        }) &&
        (reconciledChange === undefined ||
          this.isProjectInputCompilerOutput(reconciledChange, identities) ===
            false);
      reportProjectInputDecision({
        source: "project-input",
        location,
        namedChange: changed ?? null,
        ...reloadInput,
        directlyMatched,
        topologyMatched,
        membershipChanged,
        contentChanged,
        reload,
        invalidate,
        notify,
      });
      if (notify) {
        this.callbacks.onInputChange(
          reload
            ? { kind: "config", path: reconciledChange }
            : {
                ...(invalidate ? { invalidate: true } : {}),
                kind: "project",
                path: reconciledChange,
              },
        );
      }
      return true;
    } catch (error) {
      // A rename can invalidate the old filesystem object before the
      // replacement is readable. Rebind ancestor ownership even when the
      // population scan races that transient gap, so a later create cannot be
      // stranded without a watcher.
      this.syncProjectInputWatchers(skipUnobservedProjectInputWatchRoots);
      this.callbacks.onError(location, error);
      return false;
    }
  }

  private collectProjectInputMatches(): Map<string, string> {
    const identities = createProjectInputPathIdentityContext();
    const matches = new Map<string, string>();
    // Both spellings are scanned, and each is resolved here rather than when
    // the snapshot arrived. A declaration reached through a symlink otherwise
    // keeps the identity it had when it was published, so retargeting the link
    // moves no key, changes no fingerprint, and the cycle never learns that the
    // bytes it depends on are now a different file.
    for (const file of this.projectInputDeclarations("file")) {
      if (
        fs.existsSync(file) &&
        this.isProjectInputCompilerOutput(file, identities) === false
      ) {
        const identity = identities.resolve(file);
        matches.set(identity.key, identity.path);
      }
    }
    for (const file of this.projectInputDeclarations("reload")) {
      if (
        fs.existsSync(file) &&
        this.isProjectInputCompilerOutput(file, identities) === false
      ) {
        const identity = identities.resolve(file);
        matches.set(identity.key, identity.path);
      }
    }
    for (const directory of this.projectInputDeclarations("reload-directory")) {
      if (
        WatchPaths.isDirectory(directory) &&
        this.isProjectInputCompilerOutputDirectory(directory, identities) ===
          false
      ) {
        const identity = identities.resolve(directory);
        matches.set(identity.key, identity.path);
      }
    }
    const globRoots = new Map<string, { root: string; patterns: string[] }>();
    for (const glob of this.projectInputDeclarations("glob")) {
      const root = literalGlobRoot(glob);
      if (
        WatchPaths.isDirectory(root) === false ||
        this.isProjectInputCompilerOutputDirectory(root, identities)
      ) {
        continue;
      }
      const identity = identities.resolve(root);
      const group = globRoots.get(identity.key) ?? {
        root: identity.path,
        patterns: [],
      };
      group.patterns.push(glob);
      globRoots.set(identity.key, group);
    }
    // One native walk serves all patterns below a physical ancestor. Per-file
    // matching still uses every declaration's own root and wildcard semantics.
    for (const root of projectInputActiveWatchDirectories(
      [...globRoots.values()].map((group) => group.root),
      identities,
    )) {
      const patterns = [...globRoots.values()]
        .filter((group) => identities.isWithin(root, group.root))
        .flatMap((group) => group.patterns);
      const stack = [root];
      while (stack.length !== 0) {
        const current = stack.pop()!;
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(current, { withFileTypes: true });
        } catch (error) {
          if (isVanishedFilesystemEntry(error)) continue;
          throw error;
        }
        for (const entry of entries) {
          const location = path.join(current, entry.name);
          if (this.isProjectInputCompilerOutput(location, identities)) {
            continue;
          }
          if (entry.isDirectory()) {
            stack.push(location);
          } else if (
            entry.isFile() &&
            patterns.some((glob) =>
              matchesProjectInputGlob(glob, location, identities),
            )
          ) {
            const identity = identities.resolve(location);
            matches.set(identity.key, identity.path);
          }
        }
      }
    }
    return matches;
  }

  private refreshFromDirectory(location: string, changed?: string): void {
    if (
      changed !== undefined &&
      WatchPaths.isDirectory(changed) &&
      this.isCompilerOutputDirectory(changed) === false &&
      this.isProjectInputDirectory(changed) === false
    ) {
      this.observedDirectories.set(this.pathKey(changed), changed);
    }
    try {
      this.refresh(true);
    } catch (error) {
      for (const reload of reloadInputsForFailedTopologyRefresh(
        this.reloadFiles.values(),
        changed,
        this.lexicalIdentities,
      )) {
        this.callbacks.onInputChange({ kind: "config", path: reload });
      }
      this.callbacks.onError(location, error);
    }
  }

  private isCompilerOutputDirectory(location: string): boolean {
    return [...this.outputs.values()].some((output) =>
      WatchPaths.isPathWithin(output, location, this.lexicalIdentities),
    );
  }

  private isCompilerOutput(location: string): boolean {
    return (
      this.outputFiles.has(this.pathKey(location)) ||
      this.isCompilerOutputDirectory(location)
    );
  }

  private isProjectInputCompilerOutputDirectory(
    location: string,
    identities: ProjectInputPathIdentityContext,
  ): boolean {
    const root = this.projectInputs.root;
    let overlaps = this.projectInputCompilerOutputOverlaps.get(identities);
    if (overlaps === undefined) {
      overlaps = new Map();
      this.projectInputCompilerOutputOverlaps.set(identities, overlaps);
    }
    return [...this.outputs.values()].some((output) => {
      if (!identities.isWithin(output, location)) return false;
      // An output directory that is the project itself, or holds it, is not a
      // place where only build products live -- the sources are there too. A
      // project emitting in place declares exactly that, and honouring it
      // literally would classify every declared input as a product and leave
      // the whole lane unwatched without anything failing to say so. Watching
      // is the safe side here: a product that gets watched costs an extra
      // rebuild, while an input that does not is never seen again.
      if (root !== "" && identities.isWithin(output, root)) return false;
      let overlapsCompilerInput = overlaps.get(output);
      if (overlapsCompilerInput === undefined) {
        overlapsCompilerInput = [...this.files.values()].some((input) =>
          identities.isWithin(output, input),
        );
        overlaps.set(output, overlapsCompilerInput);
      }
      if (overlapsCompilerInput) return false;
      return true;
    });
  }

  private isProjectInputCompilerOutput(
    location: string,
    identities: ProjectInputPathIdentityContext,
  ): boolean {
    const key = identities.resolve(location).key;
    return (
      [...this.outputFiles.values()].some(
        (output) => identities.resolve(output).key === key,
      ) || this.isProjectInputCompilerOutputDirectory(location, identities)
    );
  }

  private isProjectInputDirectory(location: string): boolean {
    const resolved = path.resolve(location);
    const identities = createProjectInputPathIdentityContext();
    return (
      this.projectInputs.files.some(
        (file) =>
          identities.isWithin(resolved, file) ||
          identities.isWithin(path.dirname(file), resolved),
      ) ||
      (this.projectInputs.reloadFiles ?? []).some(
        (file) =>
          identities.isWithin(resolved, file) ||
          identities.isWithin(path.dirname(file), resolved),
      ) ||
      (this.projectInputs.reloadDirectories ?? []).some(
        (directory) =>
          identities.isWithin(resolved, directory) ||
          identities.isWithin(directory, resolved),
      ) ||
      this.projectInputs.globs.some((glob) => {
        const root = literalGlobRoot(glob);
        return (
          identities.isWithin(root, resolved) ||
          identities.isWithin(resolved, root)
        );
      })
    );
  }

  private classifyCompilerInput(
    location: string,
  ): "compiler" | "config" | "plugin" {
    if (this.isPluginInput(location)) return "plugin";
    return this.reloadFiles.has(this.pathKey(location)) ? "config" : "compiler";
  }

  /**
   * Note a notification at `location` against the plugin inputs it may have
   * moved, to be decided once the delivery it came in has reached every
   * listener (`decidePluginNotifications`).
   *
   * A watcher reports more than an edit. Windows reports a directory's entry as
   * changed when only its metadata moved, such as its access time after a build
   * enumerated it, and a notification taken at its word restarted the resident
   * check host for a plugin whose sources nobody edited. An input is decided by
   * what its build reads, which is every one of its source files, so the
   * notifications of one delivery are decided together: an install or a
   * checkout brings hundreds, and each input they name is read once. A location
   * no input covers, such as a directory above one, names every input.
   */
  private notePluginNotification(location: string): void {
    const resolved = path.resolve(location);
    const covering = this.extraInputs.filter((input) =>
      pluginSourceCovers(input, resolved, "entry"),
    );
    for (const input of covering.length === 0 ? this.extraInputs : covering) {
      const key = this.pathKey(input);
      const locations = this.pendingPluginNotifications.get(key) ?? new Set();
      locations.add(location);
      this.pendingPluginNotifications.set(key, locations);
    }
    if (this.pluginNotificationsScheduled) return;
    this.pluginNotificationsScheduled = true;
    // A watcher backend hands one delivery to its listeners within one turn
    // of the event loop, so the check phase after that turn holds all of it.
    setImmediate(() => this.decidePluginNotifications());
  }

  /**
   * Report every location noted for a plugin input whose state moved, once
   * each, and record the state it moved to. A notification that moved no input
   * is dropped.
   *
   * Whether a build must rerun and what must be watched are separate questions.
   * A delivery can name a directory created below an input: while it is empty
   * it moves nothing a build reads, yet it needs a watcher of its own before a
   * file lands in it, or on a platform whose watcher reports a directory's
   * direct entries alone that file reaches no watcher. So
   * the watchers are synced first, and what a directory they start watching
   * already holds is noted into this same decision (`syncExtraWatchers`).
   */
  private decidePluginNotifications(): void {
    if (this.closed) {
      this.pendingPluginNotifications = new Map();
      this.pluginNotificationsScheduled = false;
      return;
    }
    this.beginLexicalTransaction();
    // Still scheduled while syncing, so what the sync notes joins this decision
    // instead of scheduling another.
    this.syncExtraWatchers();
    this.pluginNotificationsScheduled = false;
    const pending = this.pendingPluginNotifications;
    this.pendingPluginNotifications = new Map();
    const reported = new Set<string>();
    for (const input of this.extraInputs) {
      const key = this.pathKey(input);
      const locations = pending.get(key);
      if (locations === undefined) continue;
      const state = pluginInputState(input);
      if (this.pluginInputStates.get(key) === state) continue;
      this.pluginInputStates.set(key, state);
      for (const location of locations) {
        if (reported.has(location)) continue;
        reported.add(location);
        this.callbacks.onInputChange({ kind: "plugin", path: location });
      }
    }
  }

  /**
   * Whether a path is one a plugin build keys on: the plugin input itself, or a
   * path below it outside every directory the build passes over
   * (`pluginSourceCovers`). A write in a plugin module's
   * `node_modules` or `.git` is not one, whatever watcher heard it.
   *
   * Nor is such a directory's own entry. Windows reports every write inside a
   * directory as a change of that directory's entry to a watch on its parent,
   * and nothing of a directory the build passes over, or below it, is a source.
   * An entry of the same name that is a file is one the build reads.
   */
  private isPluginInput(location: string): boolean {
    const resolved = path.resolve(location);
    if (
      prunesPluginSourceDirectory(path.basename(resolved)) &&
      WatchPaths.isDirectory(resolved)
    ) {
      return false;
    }
    return this.extraInputs.some((input) =>
      pluginSourceCovers(input, resolved, "entry"),
    );
  }
}

type WatchTopologyOptions = Pick<
  TtscBuildOptions,
  | "binary"
  | "emit"
  | "env"
  | "outDir"
  | "passthrough"
  | "projectRoot"
  | "tsconfig"
> & {
  cwd: string;
  files: readonly string[];
};

type WatchTopologyCallbacks = {
  onError(location: string, error: unknown): void;
  onInputChange(change: WatchInputChange): void;
  onProjectInputWatchUnavailable?(roots: readonly string[]): void;
  onProjectInputWatchRoots?(roots: readonly string[]): void;
  onTopologyChange(): void;
};

type ResolvedWatchTopology = {
  analysisOnly: boolean;
  directories: Map<string, string>;
  files: Map<string, string>;
  outputFiles: Map<string, string>;
  outputs: Map<string, string>;
  reloadFiles: Map<string, string>;
};

type CompilerFileSnapshot = {
  content: string;
  fingerprint: string;
  owner: string;
};

type CompilerFileMovement = {
  content: boolean;
  owner: boolean;
};

function resolveWatchTopology(
  options: WatchTopologyOptions,
  extraInputs: readonly string[],
  identities: ProjectInputPathIdentityContext,
  getCompilerInputs: typeof listCompilerInputs,
): ResolvedWatchTopology {
  let analysisOnly = options.emit === false;
  const files = new Map<string, string>();
  const outputFiles = new Map<string, string>();
  const outputs = new Map<string, string>();
  const reloadFiles = new Map<string, string>();
  const roots: string[] = [];
  if (options.files.length !== 0) {
    const project = readProjectConfig({
      cwd: options.cwd,
      projectRoot: options.projectRoot,
      tsconfig: options.tsconfig,
    });
    analysisOnly = watchTopologyAnalysisOnly(options, project);
    roots.push(project.root);
    addPaths(files, project.configPaths, identities);
    addPaths(reloadFiles, project.configPaths, identities);
    const positionalInputs = options.files.map((file) =>
      path.resolve(options.cwd, file),
    );
    if (
      positionalInputs.length === 1 &&
      (options.emit ?? project.compilerOptions.noEmit !== true)
    ) {
      addPaths(
        outputFiles,
        [
          resolveSingleFileOutput({
            cliOutDir: options.outDir,
            cwd: options.cwd,
            file: positionalInputs[0]!,
            passthrough: options.passthrough,
            tsconfig: options.tsconfig,
          }),
        ],
        identities,
      );
    }
    addPaths(files, positionalInputs, identities);
  } else {
    const projects = readReferencedProjects(options, identities);
    if (projects[0] !== undefined) {
      analysisOnly = watchTopologyAnalysisOnly(options, projects[0]);
    }
    for (const project of projects) {
      roots.push(project.root);
      addPaths(files, project.configPaths, identities);
      addPaths(reloadFiles, project.configPaths, identities);
      const compilerInputs = getCompilerInputs(project, options);
      const compilerOutputs = resolveCompilerOutputs(project, options);
      addPaths(outputFiles, compilerOutputs.files, identities);
      addPaths(
        outputFiles,
        inferPerSourceCompilerOutputs(
          project,
          options,
          compilerInputs,
          identities,
        ),
        identities,
      );
      addPaths(outputs, compilerOutputs.directories, identities);
      addPaths(files, compilerInputs, identities);
    }
  }
  addPaths(files, extraInputs, identities);
  return {
    analysisOnly,
    directories: collectTopologyDirectories(files.values(), roots, identities),
    files,
    outputFiles,
    outputs,
    reloadFiles,
  };
}

function watchTopologyAnalysisOnly(
  options: WatchTopologyOptions,
  project: ITtscParsedProjectConfig,
): boolean {
  if (options.emit !== undefined) return options.emit === false;
  const noEmit =
    passthroughBooleanOption(
      readCompilerOptionValues(options.passthrough).values,
      "--noEmit",
    ) ?? project.compilerOptions.noEmit === true;
  return noEmit;
}

function readReferencedProjects(
  options: WatchTopologyOptions,
  identities: ProjectInputPathIdentityContext,
): ITtscParsedProjectConfig[] {
  const root = readProjectConfig({
    cwd: options.cwd,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  const projects: ITtscParsedProjectConfig[] = [];
  const queue = [root];
  const seen = new Set<string>();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const project = queue[cursor]!;
    const key = WatchPaths.pathKey(project.path, identities);
    if (seen.has(key)) continue;
    seen.add(key);
    projects.push(project);
    for (const reference of readProjectReferences(project.path)) {
      queue.push(
        readProjectConfig({
          cwd: path.dirname(project.path),
          tsconfig: reference,
        }),
      );
    }
  }
  return projects;
}

function readProjectReferences(tsconfig: string): string[] {
  const parsed = readJsoncFile(tsconfig);
  if (
    isRecord(parsed) === false ||
    Array.isArray(parsed.references) === false
  ) {
    return [];
  }
  const base = path.dirname(tsconfig);
  const references: string[] = [];
  for (const reference of parsed.references) {
    if (
      isRecord(reference) === false ||
      typeof reference.path !== "string" ||
      reference.path.length === 0
    ) {
      continue;
    }
    references.push(path.resolve(base, reference.path));
  }
  return references;
}

function listCompilerInputs(
  project: ITtscParsedProjectConfig,
  options: WatchTopologyOptions,
): string[] {
  const tsgo = resolveTsgo({
    binary: options.binary,
    cwd: project.root,
    env: options.env,
  });
  const result = spawnNative(
    tsgo.binary,
    [
      "-p",
      project.path,
      "--listFilesOnly",
      "--pretty",
      "false",
      ...(options.passthrough ?? []),
    ],
    {
      cwd: project.root,
      env: { ...process.env, ...options.env },
      encoding: "utf8",
    },
  );
  if (result.error) {
    throw new Error(
      `ttsc: failed to list compiler inputs: ${result.error.message}`,
    );
  }
  // `--listFilesOnly` is the authority for compiler inputs. A path may also be
  // a predicted product of another input, but that collision does not revoke
  // its Program membership—especially while the compiler is reporting an
  // overwrite diagnostic. Product inference is used only to classify future
  // filesystem events, never to subtract from the compiler's answer.
  const inputs = outputText(result.stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => path.isAbsolute(line))
    .map((line) => path.resolve(line));
  if (result.status !== 0 && inputs.length === 0) {
    throw new Error(
      `ttsc: failed to list compiler inputs:\n${outputText(result.stderr) || outputText(result.stdout)}`,
    );
  }
  return inputs;
}

function resolveCompilerOutputs(
  project: ITtscParsedProjectConfig,
  options: WatchTopologyOptions,
): { directories: string[]; files: string[] } {
  const emit = effectiveCompilerEmit(project, options);
  const directories = new Set<string>();
  const files = new Set<string>();
  if (
    emit.outDir !== undefined &&
    (emit.javascript || (emit.declaration && emit.declarationDir === undefined))
  ) {
    directories.add(emit.outDir);
  }
  if (emit.declaration && emit.declarationDir !== undefined) {
    directories.add(emit.declarationDir);
  }
  if (emit.incremental) {
    files.add(defaultTsBuildInfoFile(project, emit));
  }
  return {
    directories: [...directories],
    files: [...files],
  };
}

function inferPerSourceCompilerOutputs(
  project: ITtscParsedProjectConfig,
  options: WatchTopologyOptions,
  inputs: readonly string[],
  identities: ProjectInputPathIdentityContext,
): string[] {
  const emit = effectiveCompilerEmit(project, options);
  const outputs = new Set<string>();
  // TypeScript-Go 7 requires an explicit rootDir when output layout would
  // otherwise need inference. While reporting TS5011 it still emits relative
  // to the config directory, so the watch model must use that same recovery
  // layout rather than the legacy common-source-directory rule.
  const sourceRoot = emit.rootDir ?? project.root;
  for (const input of inputs) {
    const extension = path.extname(input).toLowerCase();
    if (/\.d\.(?:ts|mts|cts)$/i.test(input)) continue;
    const stem = input.slice(0, -extension.length);
    const mappedStem = (
      directory: string | undefined,
      adjacentWhenOutside: boolean,
    ): string | undefined => {
      if (directory === undefined) return stem;
      if (!WatchPaths.isPathWithin(sourceRoot, input, identities)) {
        return adjacentWhenOutside ? stem : undefined;
      }
      return path.resolve(directory, path.relative(sourceRoot, stem));
    };
    if (extension === ".json") {
      if (
        emit.javascript &&
        emit.resolveJsonModule &&
        emit.outDir !== undefined
      ) {
        const jsonStem = mappedStem(emit.outDir, false);
        if (jsonStem !== undefined) outputs.add(`${jsonStem}.json`);
      }
      continue;
    }
    if (!ProjectInputWatchRules.isCompilerEmittableSourceExtension(extension))
      continue;
    if (
      emit.javascript &&
      (emit.outDir !== undefined ||
        !isJavaScriptSourceExtension(extension) ||
        (extension === ".jsx" && emit.jsx !== "preserve"))
    ) {
      const javascriptExtension =
        extension === ".mts" || extension === ".mjs"
          ? ".mjs"
          : extension === ".cts" || extension === ".cjs"
            ? ".cjs"
            : (extension === ".tsx" || extension === ".jsx") &&
                emit.jsx === "preserve"
              ? ".jsx"
              : ".js";
      const javascriptStem = mappedStem(emit.outDir, true);
      if (javascriptStem !== undefined) {
        const javascript = javascriptStem + javascriptExtension;
        outputs.add(javascript);
        if (emit.sourceMap) outputs.add(`${javascript}.map`);
      }
    }
    if (emit.declaration) {
      const declarationExtension =
        extension === ".mts" || extension === ".mjs"
          ? ".d.mts"
          : extension === ".cts" || extension === ".cjs"
            ? ".d.cts"
            : ".d.ts";
      const declarationStem = mappedStem(
        emit.declarationDir ?? emit.outDir,
        true,
      );
      if (declarationStem !== undefined) {
        const declaration = declarationStem + declarationExtension;
        outputs.add(declaration);
        if (emit.declarationMap) outputs.add(`${declaration}.map`);
      }
    }
  }
  return [...outputs];
}

function isJavaScriptSourceExtension(extension: string): boolean {
  return [".cjs", ".js", ".jsx", ".mjs"].includes(extension);
}

type EffectiveCompilerEmit = {
  declaration: boolean;
  declarationDir?: string;
  declarationMap: boolean;
  incremental: boolean;
  javascript: boolean;
  jsx?: unknown;
  outDir?: string;
  resolveJsonModule: boolean;
  rootDir?: string;
  sourceMap: boolean;
  tsBuildInfoFile?: string;
};

function effectiveCompilerEmit(
  project: ITtscParsedProjectConfig,
  options: WatchTopologyOptions,
): EffectiveCompilerEmit {
  const compilerOptions = project.compilerOptions;
  const passthrough = readCompilerOptionValues(options.passthrough).values;
  const noEmit =
    passthroughBooleanOption(passthrough, "--noEmit") ??
    (options.emit === false
      ? true
      : options.emit === true
        ? false
        : compilerOptions.noEmit === true);
  const composite =
    passthroughBooleanOption(passthrough, "--composite") ??
    compilerOptions.composite === true;
  const incremental =
    composite ||
    (passthroughBooleanOption(passthrough, "--incremental") ??
      compilerOptions.incremental === true);
  const emitDeclarationOnly =
    passthroughBooleanOption(passthrough, "--emitDeclarationOnly") ??
    (options.emit === true
      ? false
      : compilerOptions.emitDeclarationOnly === true);
  const declaration =
    !noEmit &&
    (composite ||
      (passthroughBooleanOption(passthrough, "--declaration") ??
        compilerOptions.declaration === true));
  const javascript = !noEmit && !emitDeclarationOnly;
  const sourceMap =
    javascript &&
    (passthroughBooleanOption(passthrough, "--sourceMap") ??
      compilerOptions.sourceMap === true) &&
    !(
      passthroughBooleanOption(passthrough, "--inlineSourceMap") ??
      compilerOptions.inlineSourceMap === true
    );
  const declarationMap =
    declaration &&
    (passthroughBooleanOption(passthrough, "--declarationMap") ??
      compilerOptions.declarationMap === true);
  const cliOutDir = passthroughPathOption(passthrough, "--outDir");
  const cliDeclarationDir = passthroughPathOption(
    passthrough,
    "--declarationDir",
  );
  const cliRootDir = passthroughPathOption(passthrough, "--rootDir");
  const cliTsBuildInfoFile = passthroughPathOption(
    passthrough,
    "--tsBuildInfoFile",
  );
  // Presence carries explicit null/empty enum resets. A configured JSX string
  // follows JSON's lowercase-only contract, never the CLI whitespace trim.
  const rawJsx = passthrough.has("jsx")
    ? passthrough.get("jsx")
    : typeof compilerOptions.jsx === "string"
      ? normalizeCompilerEnumValue(compilerOptions.jsx, "json")
      : undefined;
  const jsx = typeof rawJsx === "string" ? rawJsx : undefined;
  const compilerCwd = project.root;
  return {
    declaration,
    declarationDir:
      cliDeclarationDir === null
        ? undefined
        : cliDeclarationDir !== undefined
          ? path.resolve(compilerCwd, cliDeclarationDir)
          : typeof compilerOptions.declarationDir === "string"
            ? path.resolve(compilerOptions.declarationDir)
            : undefined,
    declarationMap,
    incremental,
    javascript,
    outDir:
      cliOutDir === null
        ? undefined
        : cliOutDir !== undefined
          ? path.resolve(compilerCwd, cliOutDir)
          : options.outDir !== undefined
            ? path.resolve(options.cwd, options.outDir)
            : typeof compilerOptions.outDir === "string"
              ? path.resolve(compilerOptions.outDir)
              : undefined,
    resolveJsonModule:
      passthroughBooleanOption(passthrough, "--resolveJsonModule") ??
      compilerOptions.resolveJsonModule === true,
    rootDir:
      cliRootDir === null
        ? undefined
        : cliRootDir !== undefined
          ? path.resolve(compilerCwd, cliRootDir)
          : typeof compilerOptions.rootDir === "string"
            ? path.resolve(compilerOptions.rootDir)
            : undefined,
    sourceMap,
    tsBuildInfoFile:
      cliTsBuildInfoFile === null
        ? undefined
        : cliTsBuildInfoFile !== undefined
          ? path.resolve(compilerCwd, cliTsBuildInfoFile)
          : typeof compilerOptions.tsBuildInfoFile === "string"
            ? path.resolve(compilerOptions.tsBuildInfoFile)
            : undefined,
    jsx,
  };
}

function defaultTsBuildInfoFile(
  project: ITtscParsedProjectConfig,
  emit: EffectiveCompilerEmit,
): string {
  if (emit.tsBuildInfoFile !== undefined) return emit.tsBuildInfoFile;
  const configWithoutExtension = replaceOutputExtension(project.path, "");
  if (emit.outDir === undefined) return `${configWithoutExtension}.tsbuildinfo`;
  const relative =
    emit.rootDir === undefined
      ? path.basename(configWithoutExtension)
      : path.relative(emit.rootDir, configWithoutExtension);
  return path.resolve(emit.outDir, `${relative}.tsbuildinfo`);
}

function replaceOutputExtension(location: string, extension: string): string {
  const current = path.extname(location);
  return current === ""
    ? `${location}${extension}`
    : `${location.slice(0, -current.length)}${extension}`;
}

function passthroughBooleanOption(
  values: ReadonlyMap<string, unknown>,
  name: string,
): boolean | undefined {
  const value = values.get(name.slice(2));
  return typeof value === "boolean"
    ? value
    : value === null
      ? false
      : undefined;
}

function passthroughPathOption(
  values: ReadonlyMap<string, unknown>,
  name: string,
): string | null | undefined {
  const value = values.get(name.slice(2));
  return typeof value === "string" || value === null ? value : undefined;
}

function collectTopologyDirectories(
  files: Iterable<string>,
  roots: readonly string[],
  identities: ProjectInputPathIdentityContext,
): Map<string, string> {
  const directories = new Map<string, string>();
  for (const root of roots) {
    directories.set(WatchPaths.pathKey(root, identities), root);
  }
  for (const file of files) {
    const directory = path.dirname(file);
    const root = roots.find((candidate) =>
      WatchPaths.isPathWithin(candidate, directory, identities),
    );
    if (root === undefined) {
      directories.set(WatchPaths.pathKey(directory, identities), directory);
      continue;
    }
    let current = directory;
    while (true) {
      directories.set(WatchPaths.pathKey(current, identities), current);
      if (
        WatchPaths.pathKey(current, identities) ===
        WatchPaths.pathKey(root, identities)
      )
        break;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return directories;
}

/**
 * Every directory of a plugin input a watch observes: the input and the
 * directories below it, except those the plugin build passes over and all below
 * them (`prunesPluginSourceDirectory`). The input is a
 * plugin's whole Go module, which can be a repository with its own
 * `node_modules` and `.git`; watching those would rebuild for every package
 * install and commit without the build reading any of it.
 */
function collectInputDirectories(input: string): string[] {
  return collectPluginSourceDirectories(input);
}

function isVanishedFilesystemEntry(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function closeWatchers(watchers: Map<string, DirectoryWatcher>): void {
  for (const watcher of watchers.values()) watcher.close();
  watchers.clear();
}

function addPaths(
  target: Map<string, string>,
  paths: Iterable<string>,
  identities: ProjectInputPathIdentityContext,
): void {
  for (const location of paths) {
    const resolved = path.resolve(location);
    target.set(WatchPaths.pathKey(resolved, identities), resolved);
  }
}

function uniqueExistingPaths(
  paths: readonly string[],
  identities: ProjectInputPathIdentityContext,
): string[] {
  const unique = new Map<string, string>();
  for (const location of paths) {
    if (location.length === 0) continue;
    const resolved = path.resolve(location);
    unique.set(WatchPaths.pathKey(resolved, identities), resolved);
  }
  return [...unique.values()];
}

function normalizeProjectInputSnapshot(
  snapshot: ITtscProjectInputSnapshot,
): ITtscProjectInputSnapshot {
  const identities = createProjectInputPathIdentityContext();
  const files = new Map<string, string>();
  const globs = new Map<string, string>();
  const reloadDirectories = new Map<string, string>();
  const reloadFiles = new Map<string, string>();
  for (const file of snapshot.files) {
    const identity = identities.resolve(file);
    files.set(identity.key, identity.path);
  }
  for (const glob of snapshot.globs) {
    const identity = identities.resolve(glob);
    globs.set(identity.key, identity.path.split(path.sep).join("/"));
  }
  for (const file of snapshot.reloadFiles ?? []) {
    const identity = identities.resolve(file);
    reloadFiles.set(identity.key, identity.path);
  }
  for (const directory of snapshot.reloadDirectories ?? []) {
    const identity = identities.resolve(directory);
    reloadDirectories.set(identity.key, identity.path);
  }
  return {
    files: [...files.values()].sort(),
    globs: [...globs.values()].sort(),
    reloadDirectories: [...reloadDirectories.values()].sort(),
    reloadFiles: [...reloadFiles.values()].sort(),
    root: identities.resolve(snapshot.root).path,
  };
}

function projectInputSnapshotsEqual(
  left: ITtscProjectInputSnapshot,
  right: ITtscProjectInputSnapshot,
): boolean {
  const identities = createProjectInputPathIdentityContext();
  return (
    // Every sibling comparison in this class decides on identity, and this one
    // is only safe today because both operands come from the same normalizer.
    identities.resolve(left.root || ".").key ===
      identities.resolve(right.root || ".").key &&
    arraysEqual(left.files, right.files) &&
    arraysEqual(left.globs, right.globs) &&
    arraysEqual(left.reloadDirectories ?? [], right.reloadDirectories ?? []) &&
    arraysEqual(left.reloadFiles ?? [], right.reloadFiles ?? [])
  );
}

function projectInputDeclarationKey(
  kind: "file" | "glob" | "reload" | "reload-directory",
  declaration: string,
): string {
  return `${kind}\0${resolveProjectInputPath(declaration)}`;
}

/**
 * Metadata, fingerprint, and physical-owner identities for a tracked file.
 *
 * Modification time and size avoid a read on an ordinary broad scan. A strong
 * event compares the fingerprint, so a timestamp collision cannot hide an edit
 * and a metadata-only notification does not create a build. Device and inode
 * answer whether a POSIX per-file watcher still owns the path.
 */
function compilerFileSnapshot(
  location: string,
  fingerprint: string,
): CompilerFileSnapshot {
  try {
    const stats = fs.statSync(location);
    return {
      content: `${stats.mtimeMs}:${stats.size}`,
      fingerprint,
      owner: `${stats.dev}:${stats.ino}`,
    };
  } catch {
    return { content: "", fingerprint: "", owner: "" };
  }
}

function isSymbolicLink(location: string): boolean {
  try {
    return fs.lstatSync(location).isSymbolicLink();
  } catch {
    return false;
  }
}

function matchesProjectInput(
  snapshot: ITtscProjectInputSnapshot,
  location: string,
  identities = createProjectInputPathIdentityContext(),
): boolean {
  const key = identities.resolve(location).key;
  return (
    snapshot.files.some((file) => identities.resolve(file).key === key) ||
    (snapshot.reloadFiles ?? []).some(
      (file) => identities.resolve(file).key === key,
    ) ||
    (snapshot.reloadDirectories ?? []).some((directory) =>
      identities.isWithin(directory, location),
    ) ||
    snapshot.globs.some((glob) =>
      matchesProjectInputGlob(glob, location, identities),
    )
  );
}

/**
 * Attribute a complete population scan to the changes it actually observed.
 *
 * Observer attention can arrive late for bytes already admitted while another
 * member has changed. Such a name must not consume that member's delta under
 * the wrong path or select execution reload for unchanged selection bytes. A
 * directory event remains a valid cause when it contains every changed member.
 * Ancestor resolution-directory digests accompany those members rather than
 * replace their identity; unrelated directory deltas remain separate. When only
 * those digests changed, an untracked native name can still explain an
 * immediate-entry change whose member was not selected, but not another
 * directory's independent delta.
 */
function reconcileProjectInputChange(input: {
  changed?: string;
  changedInputs: readonly string[];
  identities: ProjectInputPathIdentityContext;
  next: ReadonlyMap<string, string>;
  previous: ReadonlyMap<string, string>;
  reloadDirectories: readonly string[];
}): string | undefined {
  const directories = new Set(
    input.reloadDirectories.map(
      (location) => input.identities.resolve(location).key,
    ),
  );
  const members = input.changedInputs.filter(
    (location) => !directories.has(input.identities.resolve(location).key),
  );
  const memberAncestors = new Set<string>();
  for (const member of members) {
    let ancestor = path.dirname(input.identities.resolve(member).path);
    while (true) {
      const identity = input.identities.resolve(ancestor);
      if (memberAncestors.has(identity.key)) break;
      memberAncestors.add(identity.key);
      const parent = path.dirname(identity.path);
      if (parent === identity.path) break;
      ancestor = parent;
    }
  }
  const observed = input.changedInputs.filter((location) => {
    const key = input.identities.resolve(location).key;
    return !directories.has(key) || !memberAncestors.has(key);
  });
  const changed = input.changed;
  if (changed !== undefined) {
    const key = input.identities.resolve(changed).key;
    if (
      observed.every((location) =>
        input.identities.isWithin(changed, location),
      ) ||
      (members.length === 0 &&
        !input.previous.has(key) &&
        !input.next.has(key) &&
        observed.every(
          (location) =>
            input.identities.resolve(location).key ===
            input.identities.resolve(path.dirname(changed)).key,
        ))
    ) {
      return changed;
    }
  }
  return observed.length === 1 ? observed[0] : undefined;
}

function projectInputChangedPaths(input: {
  next: ReadonlyMap<string, string>;
  nextFingerprints: ReadonlyMap<string, string>;
  previous: ReadonlyMap<string, string>;
  previousFingerprints: ReadonlyMap<string, string>;
}): string[] {
  const changed = new Map<string, string>();
  const keys = new Set([
    ...input.previous.keys(),
    ...input.next.keys(),
    ...input.previousFingerprints.keys(),
    ...input.nextFingerprints.keys(),
  ]);
  for (const key of keys) {
    if (
      input.previous.has(key) === input.next.has(key) &&
      input.previousFingerprints.get(key) === input.nextFingerprints.get(key)
    ) {
      continue;
    }
    const location = input.next.get(key) ?? input.previous.get(key);
    if (location !== undefined) changed.set(key, location);
  }
  return [...changed.values()];
}

function compilerMembershipChange(
  previous: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>,
): string[] {
  const changed = new Map<string, string>();
  for (const [key, location] of previous) {
    if (next.has(key) === false) changed.set(key, location);
  }
  for (const [key, location] of next) {
    if (previous.has(key) === false) changed.set(key, location);
  }
  return [...changed.values()].sort();
}

function projectInputCompilerMembershipChange(
  snapshot: ITtscProjectInputSnapshot,
  changed: readonly string[],
): string[] {
  const identities = createProjectInputPathIdentityContext();
  return changed.filter(
    (location) =>
      matchesProjectInput(snapshot, location, identities) &&
      ProjectInputWatchRules.projectInputPathMayAffectProgram(location),
  );
}

/**
 * Name a compiler-membership transition as the recursive project watcher does.
 *
 * Creating the first member below a missing glob root makes Windows report the
 * root directory before it reports the member. Reload-directory fingerprints
 * must see that same causal path: the new root then explains its ancestor's
 * immediate-entry delta instead of turning ordinary project data into a cold
 * selection reload. The deepest matching glob owns the most specific delivery.
 */
function projectInputCompilerMembershipProjectChanges(
  locations: readonly string[],
  globs: readonly string[],
): string[] {
  const identities = createProjectInputPathIdentityContext();
  const roots = globs.map((glob) => identities.resolve(literalGlobRoot(glob)));
  const changes = new Map<string, string>();
  for (const location of locations) {
    const candidate = identities.resolve(location);
    let root: (typeof roots)[number] | undefined;
    for (const entry of roots) {
      if (
        identities.isWithin(entry.path, candidate.path) &&
        (root === undefined || entry.path.length > root.path.length)
      ) {
        root = entry;
      }
    }
    const change = root ?? candidate;
    changes.set(change.key, change.path);
  }
  return [...changes.values()].sort();
}

function fingerprintProjectInputMatches(
  matches: ReadonlyMap<string, string>,
  readDirectory: typeof fs.readdirSync,
): Map<string, string> {
  const fingerprints = new Map<string, string>();
  for (const [key, location] of matches) {
    fingerprints.set(
      key,
      WatchPaths.isDirectory(location)
        ? fingerprintProjectInputDirectory(location, readDirectory)
        : fingerprintProjectInputFile(location),
    );
  }
  return fingerprints;
}

function fingerprintProjectInputFile(location: string): string {
  try {
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(location))
      .digest("hex");
  } catch {
    return "";
  }
}

function fingerprintProjectInputDirectory(
  location: string,
  readDirectory: typeof fs.readdirSync,
): string {
  try {
    const entries = readDirectory(location, { withFileTypes: true })
      .map((entry) => {
        const kind = entry.isDirectory()
          ? "directory"
          : entry.isFile()
            ? "file"
            : entry.isSymbolicLink()
              ? "symlink"
              : "other";
        let target = "";
        if (entry.isSymbolicLink()) {
          try {
            target = fs.readlinkSync(path.join(location, entry.name));
          } catch {
            target = "<unreadable>";
          }
        }
        return entry.name + "\0" + kind + "\0" + target;
      })
      .sort();
    return crypto.createHash("sha256").update(entries.join("\0")).digest("hex");
  } catch {
    return "";
  }
}

function matchesProjectInputGlob(
  pattern: string,
  location: string,
  identities = createProjectInputPathIdentityContext(),
): boolean {
  const root = identities.resolve(literalGlobRoot(pattern));
  const candidate = identities.resolve(location);
  if (!isProjectInputPathIdentityWithin(root.key, candidate.key)) return false;
  const sensitive = identities.caseSensitive(root.path);
  const patternParts = path
    .relative(root.path, identities.resolve(pattern).path)
    .split(path.sep);
  const candidateParts = path
    .relative(root.path, candidate.path)
    .split(path.sep);
  // Unknown capability is an observation-routing question, not an identity
  // proof: admit either interpretation so an unproven case policy cannot hide
  // a possible declared input. The resolver retains distinct physical keys.
  return (
    (sensitive !== false &&
      matchProjectInputGlobParts(patternParts, candidateParts)) ||
    (sensitive !== true &&
      matchProjectInputGlobParts(
        patternParts.map((segment) => segment.toLowerCase()),
        candidateParts.map((segment) => segment.toLowerCase()),
      ))
  );
}

function matchProjectInputGlobParts(
  pattern: readonly string[],
  candidate: readonly string[],
): boolean {
  const memo = new Map<string, boolean>();
  const visit = (patternIndex: number, candidateIndex: number): boolean => {
    const key = `${String(patternIndex)}:${String(candidateIndex)}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let matched: boolean;
    if (patternIndex === pattern.length) {
      matched = candidateIndex === candidate.length;
    } else if (pattern[patternIndex] === "**") {
      matched =
        visit(patternIndex + 1, candidateIndex) ||
        (candidateIndex !== candidate.length &&
          visit(patternIndex, candidateIndex + 1));
    } else {
      matched =
        candidateIndex !== candidate.length &&
        matchProjectInputGlobSegment(
          pattern[patternIndex]!,
          candidate[candidateIndex]!,
        ) &&
        visit(patternIndex + 1, candidateIndex + 1);
    }
    memo.set(key, matched);
    return matched;
  };
  return visit(0, 0);
}

function matchProjectInputGlobSegment(
  pattern: string,
  candidate: string,
): boolean {
  let source = "^";
  for (const char of pattern) {
    if (char === "*") source += ".*";
    else if (char === "?") source += ".";
    else source += char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }
  return new RegExp(`${source}$`, "u").test(candidate);
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length && left.every((value, i) => value === right[i])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * What a plugin build keys a plugin input on: the digest of the files its build
 * reads from a source directory (`pluginSourceDigest`), or a file's bytes. An
 * input that cannot be read has a state of its own, so the change that made it
 * unreadable is reported and the build names the failure.
 */
function pluginInputState(input: string): string {
  try {
    return WatchPaths.isDirectory(input)
      ? `directory:${pluginSourceDigest(input)}`
      : `file:${fingerprintProjectInputFile(input)}`;
  } catch (error) {
    return `unreadable:${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Resolve the spelling a filesystem watcher must be registered under.
 *
 * A watch declaration keeps its lexical spelling, because classification,
 * containment, and notification are all expressed in the caller's own paths.
 * The backend needs the canonical spelling instead. libuv stores the directory
 * string it was handed, expands each delivered event that still exists on disk
 * to its long path, and then requires the stored string to be that expansion's
 * prefix. A short (8.3) component makes the two disagree, and the resulting
 * assertion aborts the whole process (libuv issue 5010; upstream now returns an
 * error instead, but the bundled libuv every supported Node ships still
 * asserts). `os.tmpdir()` routinely yields such a path, so ordinary projects
 * reach it, not only tests. macOS matches events against the watched path
 * resolved through symlinks, so `/var` and `/private/var` must not be mixed
 * either. Resolving here keeps every backend comparing two canonical spellings
 * while callers keep resolving events against what they declared.
 */
function watcherRegistrationPath(location: string): string {
  try {
    return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
  } catch {
    // A vanished target makes fs.watch throw anyway, which syncWatchers already
    // routes to the error path; an unreadable ancestor is better watched under
    // its declared spelling than not watched at all.
    return location;
  }
}

/**
 * Report the actual decision inputs, without additional filesystem
 * observations.
 */
function reportProjectInputDecision(decision: Record<string, unknown>): void {
  if (!process.env.TTSC_WATCH_DEBUG_INPUTS) return;
  process.stdout.write(
    `[ttsc:debug] project-input decision ${JSON.stringify(decision)}\n`,
  );
}
