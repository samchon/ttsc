import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { outputText } from "../../../compiler/internal/outputText";
import { readJsoncFile } from "../../../compiler/internal/project/readJsoncFile";
import { readProjectConfig } from "../../../compiler/internal/project/readProjectConfig";
import { resolveTsgo } from "../../../compiler/internal/resolveTsgo";
import { spawnNative } from "../../../compiler/internal/spawnNative";
import { resolveFlagSpec } from "../../../flags/resolveFlagSpec";
import { type ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import { isProjectInputPathIdentityWithin } from "../../../internal/pathIdentity/isProjectInputPathIdentityWithin";
import { resolveProjectInputPath } from "../../../internal/pathIdentity/resolveProjectInputPath";
import { pluginSourceCovers } from "../../../plugin/internal/source/pluginSourceCovers";
import { prunesPluginSourceDirectory } from "../../../plugin/internal/source/prunesPluginSourceDirectory";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildOptions } from "../../../structures/internal/TtscBuildOptions";
import { resolveSingleFileOutput } from "../resolveSingleFileOutput";
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

/**
 * Keeps the launcher watch set aligned with the compiler's current program.
 *
 * TypeScript-Go's `--listFilesOnly` output is the authority for source and
 * declaration inputs. Configuration files, project-reference roots, and the
 * source trees of selected native plugins supplement that list, while compiler
 * outputs are filtered before any watcher is installed.
 */
export class WatchTopology {
  private analysisOnly = false;
  private closed = false;
  private compilerPostRegistrationMembershipRefresh = false;
  private compilerPostRegistrationReconciliationScheduled = false;
  private compilerPostRegistrationSkipUnobservedProjectInputWatchRoots = true;
  private directories = new Map<string, string>();
  private directoryWatchers = new Map<string, fs.FSWatcher>();
  private extraInputs: readonly string[] = [];
  private extraWatchers = new Map<string, fs.FSWatcher>();
  private compilerFileSnapshots = new Map<string, CompilerFileSnapshot>();
  private files = new Map<string, string>();
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
  private projectInputWatchers = new Map<string, fs.FSWatcher>();
  private projectInputLinkWatchers = new Map<string, fs.FSWatcher>();
  private projectInputCompilerOutputOverlaps = new WeakMap<
    ProjectInputPathIdentityContext,
    Map<string, boolean>
  >();
  private projectInputCompilerAcknowledgements = new Map<string, string>();
  private reloadFiles = new Map<string, string>();

  public constructor(
    private readonly options: WatchTopologyOptions,
    private readonly callbacks: WatchTopologyCallbacks,
  ) {}

  /** Re-resolve compiler inputs and notify only when their membership changed. */
  public refresh(notify: boolean): void {
    this.refreshCompilerInputs(notify, false);
  }

  private refreshCompilerInputs(
    notify: boolean,
    skipUnobservedProjectInputWatchRoots: boolean,
  ): void {
    const next = resolveWatchTopology(this.options, this.extraInputs);
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
        this.compilerFileSnapshots.set(key, compilerFileSnapshot(file));
      }
    }
    this.directories = next.directories;
    this.outputFiles = next.outputFiles;
    this.outputs = next.outputs;
    this.reloadFiles = next.reloadFiles;
    for (const key of this.projectInputCompilerAcknowledgements.keys()) {
      if (!next.files.has(key)) {
        this.projectInputCompilerAcknowledgements.delete(key);
      }
    }
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
   * A newly tracked compiler file also remembers that fingerprint until its
   * first named content delivery; identical bytes are the delayed creation,
   * while different bytes are a real later edit and remain observable even
   * inside filesystem timestamp resolution.
   */
  private acknowledgeProjectInputCompilerMembership(
    changed: readonly string[],
  ): boolean {
    const matches = this.collectProjectInputMatches();
    const fingerprints = fingerprintProjectInputMatches(matches);
    const identities = createProjectInputPathIdentityContext();
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
    const reload = projectInputReloadEventShouldNotify({
      causedBy,
      changed: causedBy.length === 1 ? causedBy[0] : undefined,
      changedInputs,
      globs: population.globs,
      reloadDirectories: population.reloadDirectories,
      reloadFiles: population.reloadFiles ?? [],
    });
    // The callback below consumes the complete population observed by this
    // scan. Crucially, reload classification runs against the old baseline
    // first, so a concurrent selection delta becomes one cold transition
    // instead of disappearing behind the warm compiler-membership handoff.
    this.projectInputMatches = matches;
    this.projectInputFingerprints = fingerprints;
    for (const location of changed) {
      const compilerKey = WatchPaths.pathKey(location);
      if (!this.files.has(compilerKey)) continue;
      const fingerprint = fingerprints.get(identities.resolve(location).key);
      if (fingerprint !== undefined && fingerprint !== "") {
        this.projectInputCompilerAcknowledgements.set(compilerKey, fingerprint);
      }
    }
    return reload;
  }

  /** Add Go plugin source trees discovered by the real build lane. */
  public setExtraInputs(inputs: readonly string[]): void {
    const next = uniqueExistingPaths(inputs);
    if (arraysEqual(this.extraInputs, next)) return;
    this.extraInputs = next;
    this.refresh(false);
  }

  /**
   * Reconcile project-rule dependencies, retaining absent files and empty glob
   * populations as live topology.
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
    );
    this.syncProjectInputWatchers();
  }

  /** Close every watcher so SIGINT/SIGTERM can drain the event loop. */
  public close(): void {
    this.closed = true;
    closeWatchers(this.fileWatchers);
    closeWatchers(this.directoryWatchers);
    closeWatchers(this.extraWatchers);
    closeWatchers(this.projectInputWatchers);
    closeWatchers(this.projectInputLinkWatchers);
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
        fs.watch(
          watcherRegistrationPath(location),
          { persistent: true },
          () => {
            // A per-file watcher fires on any filesystem attention its target
            // receives, and it carries no filename to distinguish an edit from
            // a touch. It answers the same question the unnamed directory event
            // answers, so it answers it the same way: from the bytes.
            const movement = this.compilerFileMovement(location);
            if (movement.owner) this.rearmFileWatchers([location], true);
            if (!movement.content) return;
            this.callbacks.onInputChange({
              kind: this.classifyCompilerInput(location),
              path: location,
            });
          },
        ),
      (location, error) => this.callbacks.onError(location, error),
      () => this.closed === false,
    );
    return [...this.fileWatchers].some(
      ([key, watcher]) => previous.get(key) !== watcher,
    );
  }

  /** Compare a tracked file's content and physical owner with its snapshot. */
  private compilerFileMovement(location: string): CompilerFileMovement {
    const key = WatchPaths.pathKey(location);
    const previous = this.compilerFileSnapshots.get(key);
    const next = compilerFileSnapshot(location);
    this.compilerFileSnapshots.set(key, next);
    return {
      content: previous?.content !== next.content,
      owner: previous?.owner !== next.owner,
    };
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
              WatchPaths.isPathWithin(candidate, location),
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
        fs.watch(
          watcherRegistrationPath(location),
          {
            persistent: true,
            recursive: process.platform === "win32",
          },
          (event, filename) => {
            const changed =
              filename === null
                ? undefined
                : path.resolve(location, filename.toString());
            const pluginInput = changed ?? location;
            if (this.isPluginInput(pluginInput)) {
              this.callbacks.onInputChange({
                kind: "plugin",
                path: pluginInput,
              });
              return;
            }
            const plan = planCompilerDirectoryWatchEvent({
              changed,
              event,
              exists: fs.existsSync,
              location,
              platform: process.platform,
              trackedFiles: this.files,
            });
            this.rearmFileWatchers(plan.rearm);
            for (const file of this.compilerChangesToReport(
              plan.changes,
              changed,
              event,
            )) {
              this.callbacks.onInputChange({
                kind: this.classifyCompilerInput(file),
                path: file,
              });
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
        if (movement.content) changed.push(file);
        if (movement.owner) rearm.push(file);
      }
      // A replacement can move the path to a new inode without changing its
      // cheap content stamp or topology key. Rebind its physical owner without
      // inventing a content notification. Missing entries remain covered by
      // their parent directory and are retried when recreation is observed.
      this.rearmFileWatchers(rearm, true);
      for (const file of changed) {
        this.callbacks.onInputChange({
          kind: this.classifyCompilerInput(file),
          path: file,
        });
      }
      if (!refreshCompilerMembership) return;
      try {
        // Directory watchers own files not present in the current Program.
        // Re-resolve even when every tracked stamp is unchanged so a swallowed
        // startup event cannot strand a newly included source.
        this.refreshCompilerInputs(true, skipUnobservedProjectInputWatchRoots);
      } catch (error) {
        const reported = new Set(changed.map(WatchPaths.pathKey));
        const reconciledChange = changed.length === 1 ? changed[0]! : undefined;
        for (const reload of reloadInputsForFailedTopologyRefresh(
          this.reloadFiles.values(),
          reconciledChange,
        )) {
          if (reported.has(WatchPaths.pathKey(reload))) continue;
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
   * Narrow a plan's changes to the tracked files that actually moved.
   *
   * A backend that cannot name what changed forces the plan to nominate every
   * tracked file under the watched directory, which is the only safe answer it
   * can give from an event carrying no filename. macOS delivers such events for
   * ordinary activity elsewhere in the project, so the compiler lane would wake
   * for sources nobody touched. Only a content notification passes through: it
   * is the one event that claims the bytes moved. A rename claims the directory
   * entry was rewritten and an unnamed event claims nothing, so both are
   * decided from the bytes, which is the question neither of them answered.
   */
  private compilerChangesToReport(
    changes: readonly string[],
    changed: string | undefined,
    event: string,
  ): string[] {
    // A content notification is taken at its word: the backend is telling us
    // these bytes changed, and second-guessing it would lose an edit that
    // landed inside the clock's resolution. A rename says the directory entry
    // was rewritten, which is a different claim — a file can be moved back, or
    // replaced by an identical copy, without its content moving at all — and an
    // event that cannot name anything makes no claim about content either.
    // Those two are decided from the bytes, and the rearm they drive is
    // unaffected, because rebinding is about the inode and not the content.
    if (changed !== undefined && event !== "rename") {
      return changes.filter((file) => {
        const key = WatchPaths.pathKey(file);
        const acknowledged = this.projectInputCompilerAcknowledgements.get(key);
        this.projectInputCompilerAcknowledgements.delete(key);
        this.recordCompilerFileSnapshot(file);
        return (
          acknowledged === undefined ||
          acknowledged !== fingerprintProjectInputFile(file)
        );
      });
    }
    return changes.filter((file) => this.compilerFileMovement(file).content);
  }

  private recordCompilerFileSnapshot(file: string): void {
    this.compilerFileSnapshots.set(
      WatchPaths.pathKey(file),
      compilerFileSnapshot(file),
    );
  }

  private rearmFileWatchers(
    files: readonly string[],
    skipMissing = false,
  ): void {
    for (const file of files) {
      const key = WatchPaths.pathKey(file);
      this.fileWatchers.get(key)?.close();
      this.fileWatchers.delete(key);
    }
    if (this.syncFileWatchers(skipMissing)) {
      this.scheduleCompilerPostRegistrationReconciliation(false, true);
    }
  }

  private syncExtraWatchers(): void {
    const directories = new Map<string, string>();
    for (const input of this.extraInputs) {
      for (const directory of collectInputDirectories(input)) {
        directories.set(WatchPaths.pathKey(directory), directory);
      }
    }
    syncWatchers(
      this.extraWatchers,
      directories,
      (location) =>
        fs.watch(
          watcherRegistrationPath(location),
          { persistent: true },
          (_event, filename) => {
            const changed =
              filename === null
                ? undefined
                : path.resolve(location, filename.toString());
            // The one decision every watcher that hears a plugin path shares;
            // here it drops the entry of a directory the build passes over.
            if (changed !== undefined && !this.isPluginInput(changed)) return;
            this.callbacks.onInputChange({
              kind: "plugin",
              path: changed ?? location,
            });
          },
        ),
      (location, error) => this.callbacks.onError(location, error),
      () => this.closed === false,
    );
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
        fs.watch(
          watcherRegistrationPath(location),
          { persistent: true, recursive: true },
          (_event, filename) => {
            const changed =
              filename === null
                ? undefined
                : path.resolve(location, filename.toString());
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
        fs.watch(
          watcherRegistrationPath(location),
          { persistent: true },
          (_event, filename) => {
            const changed =
              filename === null
                ? undefined
                : path.resolve(location, filename.toString());
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
  ): void {
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
        return;
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
          ? fingerprintProjectInputMatches(next)
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
      const reconciledChange =
        changed ?? (changedInputs.length === 1 ? changedInputs[0] : undefined);
      // Both spellings classify the event. The normalized form names the file a
      // link pointed at when the snapshot was published, so after a retarget it
      // names the wrong one; only the declared form resolves to what the link
      // points at now, which is the selection this lane exists to protect.
      const reload = projectInputReloadEventShouldNotify({
        changed: reconciledChange,
        changedInputs,
        globs: population.globs,
        reloadDirectories: population.reloadDirectories ?? [],
        reloadFiles: population.reloadFiles ?? [],
      });
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
      if (
        projectInputEventShouldNotify({
          contentChanged,
          directlyMatched,
          membershipChanged,
        }) &&
        (reconciledChange === undefined ||
          this.isProjectInputCompilerOutput(reconciledChange, identities) ===
            false)
      ) {
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
    } catch (error) {
      // A rename can invalidate the old filesystem object before the
      // replacement is readable. Rebind ancestor ownership even when the
      // population scan races that transient gap, so a later create cannot be
      // stranded without a watcher.
      this.syncProjectInputWatchers(skipUnobservedProjectInputWatchRoots);
      this.callbacks.onError(location, error);
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
    for (const glob of this.projectInputDeclarations("glob")) {
      const root = literalGlobRoot(glob);
      if (
        WatchPaths.isDirectory(root) === false ||
        this.isProjectInputCompilerOutputDirectory(root, identities)
      ) {
        continue;
      }
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
            matchesProjectInputGlob(glob, location, identities)
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
      this.observedDirectories.set(WatchPaths.pathKey(changed), changed);
    }
    try {
      this.refresh(true);
    } catch (error) {
      for (const reload of reloadInputsForFailedTopologyRefresh(
        this.reloadFiles.values(),
        changed,
      )) {
        this.callbacks.onInputChange({ kind: "config", path: reload });
      }
      this.callbacks.onError(location, error);
    }
  }

  private isCompilerOutputDirectory(location: string): boolean {
    return [...this.outputs.values()].some((output) =>
      WatchPaths.isPathWithin(output, location),
    );
  }

  private isCompilerOutput(location: string): boolean {
    return (
      this.outputFiles.has(WatchPaths.pathKey(location)) ||
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
    return this.reloadFiles.has(WatchPaths.pathKey(location))
      ? "config"
      : "compiler";
  }

  /**
   * Whether a path is one a plugin build keys on: the plugin input itself, or a
   * path below it outside every directory the build passes over
   * (`pluginSourceCovers`, samchon/ttsc#1492). A write in a plugin module's
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
  owner: string;
};

type CompilerFileMovement = {
  content: boolean;
  owner: boolean;
};

function resolveWatchTopology(
  options: WatchTopologyOptions,
  extraInputs: readonly string[],
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
    addPaths(files, project.configPaths);
    addPaths(reloadFiles, project.configPaths);
    const positionalInputs = options.files.map((file) =>
      path.resolve(options.cwd, file),
    );
    if (
      positionalInputs.length === 1 &&
      (options.emit ?? project.compilerOptions.noEmit !== true)
    ) {
      addPaths(outputFiles, [
        resolveSingleFileOutput({
          cliOutDir: options.outDir,
          cwd: options.cwd,
          file: positionalInputs[0]!,
          passthrough: options.passthrough,
          tsconfig: options.tsconfig,
        }),
      ]);
    }
    addPaths(files, positionalInputs);
  } else {
    const projects = readReferencedProjects(options);
    if (projects[0] !== undefined) {
      analysisOnly = watchTopologyAnalysisOnly(options, projects[0]);
    }
    for (const project of projects) {
      roots.push(project.root);
      addPaths(files, project.configPaths);
      addPaths(reloadFiles, project.configPaths);
      const compilerInputs = listCompilerInputs(project, options);
      const compilerOutputs = resolveCompilerOutputs(project, options);
      addPaths(outputFiles, compilerOutputs.files);
      addPaths(
        outputFiles,
        inferPerSourceCompilerOutputs(project, options, compilerInputs),
      );
      addPaths(outputs, compilerOutputs.directories);
      addPaths(files, compilerInputs);
    }
  }
  addPaths(files, extraInputs);
  return {
    analysisOnly,
    directories: collectTopologyDirectories(files.values(), roots),
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
    passthroughBooleanOption(options.passthrough, "--noEmit") ??
    project.compilerOptions.noEmit === true;
  return noEmit;
}

function readReferencedProjects(
  options: WatchTopologyOptions,
): ITtscParsedProjectConfig[] {
  const root = readProjectConfig({
    cwd: options.cwd,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  const projects: ITtscParsedProjectConfig[] = [];
  const queue = [root];
  const seen = new Set<string>();
  while (queue.length !== 0) {
    const project = queue.shift()!;
    if (seen.has(WatchPaths.pathKey(project.path))) continue;
    seen.add(WatchPaths.pathKey(project.path));
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
      if (!WatchPaths.isPathWithin(sourceRoot, input)) {
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
  const passthrough = options.passthrough;
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
  const jsx =
    passthroughStringOption(passthrough, "--jsx") ?? compilerOptions.jsx;
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
  tokens: readonly string[] | undefined,
  name: string,
): boolean | undefined {
  let value: boolean | undefined;
  for (let index = 0; index < (tokens?.length ?? 0); index++) {
    const token = tokens?.[index];
    if (token === undefined) continue;
    if (!passthroughOptionMatches(token, name)) continue;
    const next = tokens?.[index + 1];
    if (next === "true" || next === "false" || next === "null") {
      value = next === "true";
      index++;
    } else {
      value = true;
    }
  }
  return value;
}

function passthroughPathOption(
  tokens: readonly string[] | undefined,
  name: string,
): string | null | undefined {
  let value: string | null | undefined;
  for (let index = 0; index < (tokens?.length ?? 0); index++) {
    const token = tokens?.[index];
    if (token === undefined) continue;
    if (!passthroughOptionMatches(token, name)) continue;
    if (index + 1 < (tokens?.length ?? 0)) {
      const next = tokens?.[++index];
      value = next === "null" ? null : next;
    }
  }
  return value;
}

function passthroughStringOption(
  tokens: readonly string[] | undefined,
  name: string,
): string | undefined {
  return passthroughPathOption(tokens, name)?.toLowerCase() ?? undefined;
}

function passthroughOptionMatches(token: string, name: string): boolean {
  if (!token.startsWith("-")) return false;
  if (token.includes("=")) return false;
  return resolveFlagSpec(token)?.name === resolveFlagSpec(name)?.name;
}

function collectTopologyDirectories(
  files: Iterable<string>,
  roots: readonly string[],
): Map<string, string> {
  const directories = new Map<string, string>();
  for (const root of roots) {
    directories.set(WatchPaths.pathKey(root), root);
  }
  for (const file of files) {
    const directory = path.dirname(file);
    const root = roots.find((candidate) =>
      WatchPaths.isPathWithin(candidate, directory),
    );
    if (root === undefined) {
      directories.set(WatchPaths.pathKey(directory), directory);
      continue;
    }
    let current = directory;
    while (true) {
      directories.set(WatchPaths.pathKey(current), current);
      if (WatchPaths.pathKey(current) === WatchPaths.pathKey(root)) break;
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
 * them (`prunesPluginSourceDirectory`, samchon/ttsc#1492). The input is a
 * plugin's whole Go module, which can be a repository with its own
 * `node_modules` and `.git`; watching those would rebuild for every package
 * install and commit without the build reading any of it.
 */
function collectInputDirectories(input: string): string[] {
  if (WatchPaths.isDirectory(input) === false) return [];
  const directories: string[] = [];
  const stack = [input];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    directories.push(current);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      if (isVanishedFilesystemEntry(error)) continue;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !prunesPluginSourceDirectory(entry.name)) {
        stack.push(path.join(current, entry.name));
      }
    }
  }
  return directories;
}

function isVanishedFilesystemEntry(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function closeWatchers(watchers: Map<string, fs.FSWatcher>): void {
  for (const watcher of watchers.values()) watcher.close();
  watchers.clear();
}

function addPaths(target: Map<string, string>, paths: Iterable<string>): void {
  for (const location of paths) {
    const resolved = path.resolve(location);
    target.set(WatchPaths.pathKey(resolved), resolved);
  }
}

function uniqueExistingPaths(paths: readonly string[]): string[] {
  const unique = new Map<string, string>();
  for (const location of paths) {
    if (location.length === 0) continue;
    const resolved = path.resolve(location);
    unique.set(WatchPaths.pathKey(resolved), resolved);
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
 * Cheap content and physical-owner identities for a tracked file.
 *
 * Modification time and size answer "did the bytes move" without reading the
 * file. Device and inode answer whether a POSIX per-file watcher still owns the
 * path. Keeping the answers separate lets an identical atomic replacement
 * rebind its watcher without inventing a compiler notification.
 */
function compilerFileSnapshot(location: string): CompilerFileSnapshot {
  try {
    const stats = fs.statSync(location);
    return {
      content: `${stats.mtimeMs}:${stats.size}`,
      owner: `${stats.dev}:${stats.ino}`,
    };
  } catch {
    return { content: "", owner: "" };
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
  return changed.filter(
    (location) =>
      matchesProjectInput(snapshot, location) &&
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
    const root = roots
      .filter((entry) => identities.isWithin(entry.path, candidate.path))
      .sort((left, right) => right.path.length - left.path.length)[0];
    const change = root ?? candidate;
    changes.set(change.key, change.path);
  }
  return [...changes.values()].sort();
}

function fingerprintProjectInputMatches(
  matches: ReadonlyMap<string, string>,
): Map<string, string> {
  const fingerprints = new Map<string, string>();
  for (const [key, location] of matches) {
    fingerprints.set(
      key,
      WatchPaths.isDirectory(location)
        ? fingerprintProjectInputDirectory(location)
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

function fingerprintProjectInputDirectory(location: string): string {
  try {
    const entries = fs
      .readdirSync(location, { withFileTypes: true })
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
  return matchProjectInputGlobParts(
    sensitive
      ? patternParts
      : patternParts.map((segment) => segment.toLowerCase()),
    sensitive
      ? candidateParts
      : candidateParts.map((segment) => segment.toLowerCase()),
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
