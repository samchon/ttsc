import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { readJsoncFile } from "../../compiler/internal/project/readConfigJson";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { outputText, spawnNative } from "../../compiler/internal/spawnNative";
import { resolveFlagSpec } from "../../flags/schema";
import {
  type ProjectInputPathIdentityContext,
  createProjectInputPathIdentityContext,
  isProjectInputPathIdentityWithin,
  resolveProjectInputPath,
} from "../../internal/projectInputPathIdentity";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectInputSnapshot } from "../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildOptions } from "../../structures/internal/TtscBuildOptions";
import { resolveSingleFileOutput } from "./singleFileOutput";

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
  onProjectInputWatchRoots?(roots: readonly string[]): void;
  onTopologyChange(): void;
};

export type WatchInputChange = {
  /** Keep the resident process but cold-load its compiler Program. */
  invalidate?: boolean;
  kind: "compiler" | "config" | "plugin" | "project";
  path?: string;
};

type ResolvedWatchTopology = {
  analysisOnly: boolean;
  directories: Map<string, string>;
  files: Map<string, string>;
  outputFiles: Map<string, string>;
  outputs: Map<string, string>;
  reloadFiles: Map<string, string>;
};

export type CompilerDirectoryWatchEventPlan = {
  changes: string[];
  rearm: string[];
  refresh: boolean;
};

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
  private directories = new Map<string, string>();
  private directoryWatchers = new Map<string, fs.FSWatcher>();
  private extraInputs: readonly string[] = [];
  private extraWatchers = new Map<string, fs.FSWatcher>();
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
  private projectInputRejectedWatchRoots = new Set<string>();
  private projectInputWatchRoots = new Map<string, string>();
  private projectInputWatchers = new Map<string, fs.FSWatcher>();
  private reloadFiles = new Map<string, string>();

  public constructor(
    private readonly options: WatchTopologyOptions,
    private readonly callbacks: WatchTopologyCallbacks,
  ) {}

  /** Re-resolve compiler inputs and notify only when their membership changed. */
  public refresh(notify: boolean): void {
    const next = resolveWatchTopology(this.options, this.extraInputs);
    const projectInputProgramChange =
      next.analysisOnly &&
      mapsEqual(this.reloadFiles, next.reloadFiles) &&
      mapsEqual(this.outputFiles, next.outputFiles) &&
      mapsEqual(this.outputs, next.outputs)
        ? projectInputCompilerMembershipChange(
            this.projectInputs,
            this.files,
            next.files,
          )
        : undefined;
    const changed =
      this.analysisOnly !== next.analysisOnly ||
      mapsEqual(this.files, next.files) === false ||
      mapsEqual(this.directories, next.directories) === false ||
      mapsEqual(this.outputFiles, next.outputFiles) === false ||
      mapsEqual(this.outputs, next.outputs) === false ||
      mapsEqual(this.reloadFiles, next.reloadFiles) === false;
    this.analysisOnly = next.analysisOnly;
    this.files = next.files;
    this.directories = next.directories;
    this.outputFiles = next.outputFiles;
    this.outputs = next.outputs;
    this.reloadFiles = next.reloadFiles;
    this.syncFileWatchers();
    this.syncDirectoryWatchers();
    this.syncExtraWatchers();
    this.syncProjectInputWatchers();
    if (notify && changed) {
      if (projectInputProgramChange !== undefined) {
        this.callbacks.onInputChange({
          invalidate: true,
          kind: "project",
          path:
            projectInputProgramChange.length === 1
              ? projectInputProgramChange[0]
              : undefined,
        });
      } else {
        this.callbacks.onTopologyChange();
      }
    }
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
    if (projectInputSnapshotsEqual(this.projectInputs, next)) return;
    this.projectInputs = next;
    this.projectInputRejectedWatchRoots.clear();
    const declarations = new Set([
      ...next.files.map((file) => projectInputDeclarationKey("file", file)),
      ...next.globs.map((glob) => projectInputDeclarationKey("glob", glob)),
      ...(next.reloadFiles ?? []).map((file) =>
        projectInputDeclarationKey("reload", file),
      ),
      ...(next.reloadDirectories ?? []).map((directory) =>
        projectInputDeclarationKey("reload-directory", directory),
      ),
    ]);
    for (const key of this.projectInputWatchRoots.keys()) {
      if (!declarations.has(key)) this.projectInputWatchRoots.delete(key);
    }
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
  }

  private syncFileWatchers(): void {
    const files =
      process.platform === "win32" ? new Map<string, string>() : this.files;
    syncWatchers(
      this.fileWatchers,
      files,
      (location) =>
        fs.watch(location, { persistent: true }, () => {
          this.callbacks.onInputChange({
            kind: this.classifyCompilerInput(location),
            path: location,
          });
        }),
      (location, error) => this.callbacks.onError(location, error),
    );
  }

  private syncDirectoryWatchers(): void {
    const desired = new Map(this.directories);
    for (const [key, location] of this.observedDirectories) {
      if (
        isDirectory(location) === false ||
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
              candidateKey !== key && isPathWithin(candidate, location),
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
          location,
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
            for (const file of plan.changes) {
              this.callbacks.onInputChange({
                kind: this.classifyCompilerInput(file),
                path: file,
              });
            }
            if (plan.refresh) this.refreshFromDirectory(location, changed);
          },
        ),
      (location, error) => this.callbacks.onError(location, error),
    );
  }

  private rearmFileWatchers(files: readonly string[]): void {
    for (const file of files) {
      const key = pathKey(file);
      this.fileWatchers.get(key)?.close();
      this.fileWatchers.delete(key);
    }
    this.syncFileWatchers();
  }

  private syncExtraWatchers(): void {
    const directories = new Map<string, string>();
    for (const input of this.extraInputs) {
      for (const directory of collectInputDirectories(input)) {
        directories.set(pathKey(directory), directory);
      }
    }
    syncWatchers(
      this.extraWatchers,
      directories,
      (location) =>
        fs.watch(location, { persistent: true }, (_event, filename) => {
          const changed =
            filename === null
              ? undefined
              : path.resolve(location, filename.toString());
          this.callbacks.onInputChange({
            kind: "plugin",
            path: changed ?? location,
          });
        }),
      (location, error) => this.callbacks.onError(location, error),
    );
  }

  private syncProjectInputWatchers(): void {
    if (this.closed) return;
    const identities = createProjectInputPathIdentityContext();
    const desired = new Map<string, string>();
    for (const file of this.projectInputs.files) {
      if (this.isProjectInputCompilerOutput(file, identities)) continue;
      const location = this.projectInputWatchRoot(
        "file",
        file,
        path.dirname(file),
      );
      if (location !== undefined) {
        const available = projectInputAvailableWatchDirectory(
          location,
          this.projectInputRejectedWatchRoots,
          identities,
        );
        if (available !== undefined) {
          const identity = identities.resolve(available);
          desired.set(identity.key, identity.path);
        }
      }
    }
    for (const glob of this.projectInputs.globs) {
      const root = literalGlobRoot(glob);
      if (this.isProjectInputCompilerOutputDirectory(root, identities)) {
        continue;
      }
      const location = this.projectInputWatchRoot("glob", glob, root);
      if (location !== undefined) {
        const available = projectInputAvailableWatchDirectory(
          location,
          this.projectInputRejectedWatchRoots,
          identities,
        );
        if (available !== undefined) {
          const identity = identities.resolve(available);
          desired.set(identity.key, identity.path);
        }
      }
    }
    for (const file of this.projectInputs.reloadFiles ?? []) {
      if (this.isProjectInputCompilerOutput(file, identities)) continue;
      const location = this.projectInputWatchRoot(
        "reload",
        file,
        path.dirname(file),
      );
      if (location !== undefined) {
        const available = projectInputAvailableWatchDirectory(
          location,
          this.projectInputRejectedWatchRoots,
          identities,
        );
        if (available !== undefined) {
          const identity = identities.resolve(available);
          desired.set(identity.key, identity.path);
        }
      }
    }
    for (const directory of this.projectInputs.reloadDirectories ?? []) {
      if (this.isProjectInputCompilerOutputDirectory(directory, identities)) {
        continue;
      }
      const location = this.projectInputWatchRoot(
        "reload-directory",
        directory,
        directory,
      );
      if (location !== undefined) {
        const available = projectInputAvailableWatchDirectory(
          location,
          this.projectInputRejectedWatchRoots,
          identities,
        );
        if (available !== undefined) {
          const identity = identities.resolve(available);
          desired.set(identity.key, identity.path);
        }
      }
    }
    const active = new Map<string, string>();
    for (const location of projectInputActiveWatchDirectories(
      desired.values(),
      identities,
    )) {
      const identity = identities.resolve(location);
      active.set(identity.key, identity.path);
    }
    syncWatchers(
      this.projectInputWatchers,
      active,
      (location) =>
        fs.watch(
          location,
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
        if (firstFailure) {
          queueMicrotask(() => this.syncProjectInputWatchers());
        }
      },
    );
    this.callbacks.onProjectInputWatchRoots?.(
      [...this.projectInputWatchers.keys()].sort(),
    );
  }

  private projectInputWatchRoot(
    kind: "file" | "glob" | "reload" | "reload-directory",
    declaration: string,
    target: string,
  ): string | undefined {
    const key = projectInputDeclarationKey(kind, declaration);
    const retained = this.projectInputWatchRoots.get(key);
    if (retained !== undefined && isDirectory(retained)) return retained;
    const resolved = projectInputRecursiveWatchRoot(
      target,
      this.projectInputs.root,
    );
    if (resolved !== undefined) this.projectInputWatchRoots.set(key, resolved);
    return resolved;
  }

  private refreshProjectInputs(location: string, changed?: string): void {
    try {
      const previous = this.projectInputMatches;
      const identities = createProjectInputPathIdentityContext();
      const directlyMatched =
        changed !== undefined &&
        (previous.has(identities.resolve(changed).key) ||
          matchesProjectInput(this.projectInputs, changed, identities));
      const topologyMatched =
        changed !== undefined &&
        projectInputTopologyMayAffect(
          this.projectInputs,
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
      const next = this.collectProjectInputMatches();
      const membershipChanged = mapsEqual(previous, next) === false;
      const nextFingerprints =
        changed === undefined ||
        membershipChanged ||
        directlyMatched ||
        topologyMatched
          ? fingerprintProjectInputMatches(next)
          : this.projectInputFingerprints;
      const contentChanged =
        mapsEqual(this.projectInputFingerprints, nextFingerprints) === false;
      const changedInputs = projectInputChangedPaths({
        next,
        nextFingerprints,
        previous,
        previousFingerprints: this.projectInputFingerprints,
      });
      const reload = projectInputReloadEventShouldNotify({
        changed,
        changedInputs,
        reloadDirectories: this.projectInputs.reloadDirectories ?? [],
        reloadFiles: this.projectInputs.reloadFiles ?? [],
      });
      const invalidate = projectInputMembershipInvalidatesProgram({
        changed,
        changedInputs,
        contentChanged,
        next,
        previous,
      });
      this.projectInputMatches = next;
      this.projectInputFingerprints = nextFingerprints;
      this.syncProjectInputWatchers();
      // A JSON/TS/JS project-input member can simultaneously enter or leave
      // the compiler Program. Reconcile the compiler watch snapshot before
      // scheduling its resident invalidation, so runWatch's post-cycle refresh
      // does not rediscover the same delta as a broader execution reload.
      if (invalidate) this.refresh(false);
      if (
        projectInputEventShouldNotify({
          contentChanged,
          directlyMatched,
          membershipChanged,
        }) &&
        (changed === undefined ||
          this.isProjectInputCompilerOutput(changed, identities) === false)
      ) {
        this.callbacks.onInputChange(
          reload
            ? { kind: "config", path: changed }
            : {
                ...(invalidate ? { invalidate: true } : {}),
                kind: "project",
                path: changed,
              },
        );
      }
    } catch (error) {
      // A rename can invalidate the old filesystem object before the
      // replacement is readable. Rebind ancestor ownership even when the
      // population scan races that transient gap, so a later create cannot be
      // stranded without a watcher.
      this.syncProjectInputWatchers();
      this.callbacks.onError(location, error);
    }
  }

  private collectProjectInputMatches(): Map<string, string> {
    const identities = createProjectInputPathIdentityContext();
    const matches = new Map<string, string>();
    for (const file of this.projectInputs.files) {
      if (
        fs.existsSync(file) &&
        this.isProjectInputCompilerOutput(file, identities) === false
      ) {
        const identity = identities.resolve(file);
        matches.set(identity.key, identity.path);
      }
    }
    for (const file of this.projectInputs.reloadFiles ?? []) {
      if (
        fs.existsSync(file) &&
        this.isProjectInputCompilerOutput(file, identities) === false
      ) {
        const identity = identities.resolve(file);
        matches.set(identity.key, identity.path);
      }
    }
    for (const directory of this.projectInputs.reloadDirectories ?? []) {
      if (
        isDirectory(directory) &&
        this.isProjectInputCompilerOutputDirectory(directory, identities) ===
          false
      ) {
        const identity = identities.resolve(directory);
        matches.set(identity.key, identity.path);
      }
    }
    for (const glob of this.projectInputs.globs) {
      const root = literalGlobRoot(glob);
      if (
        isDirectory(root) === false ||
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
      isDirectory(changed) &&
      this.isCompilerOutputDirectory(changed) === false &&
      this.isProjectInputDirectory(changed) === false
    ) {
      this.observedDirectories.set(pathKey(changed), changed);
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
      isPathWithin(output, location),
    );
  }

  private isCompilerOutput(location: string): boolean {
    return (
      this.outputFiles.has(pathKey(location)) ||
      this.isCompilerOutputDirectory(location)
    );
  }

  private isProjectInputCompilerOutputDirectory(
    location: string,
    identities: ProjectInputPathIdentityContext,
  ): boolean {
    return [...this.outputs.values()].some((output) =>
      identities.isWithin(output, location),
    );
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
    return this.reloadFiles.has(pathKey(location)) ? "config" : "compiler";
  }

  private isPluginInput(location: string): boolean {
    const resolved = path.resolve(location);
    return this.extraInputs.some(
      (input) =>
        pathKey(input) === pathKey(resolved) || isPathWithin(input, resolved),
    );
  }
}

export function reloadInputsForFailedTopologyRefresh(
  reloadFiles: Iterable<string>,
  changed?: string,
): string[] {
  const changedKey = changed === undefined ? undefined : pathKey(changed);
  const reloads = new Map<string, string>();
  for (const location of reloadFiles) {
    const resolved = path.resolve(location);
    const key = pathKey(resolved);
    if (
      (changedKey !== undefined && key === changedKey) ||
      fs.existsSync(resolved) === false
    ) {
      reloads.set(key, resolved);
    }
  }
  return [...reloads.values()].sort();
}

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
        inferAdjacentCompilerOutputs(project, options, compilerInputs),
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
    if (seen.has(pathKey(project.path))) continue;
    seen.add(pathKey(project.path));
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
  const outputs = resolveCompilerOutputs(project, options);
  const inputs = outputText(result.stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => path.isAbsolute(line))
    .map((line) => path.resolve(line))
    .filter((file) => isCompilerOutput(file, outputs) === false);
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
  if (emit.outFile !== undefined) {
    if (emit.javascript) {
      files.add(emit.outFile);
      if (emit.sourceMap) files.add(`${emit.outFile}.map`);
    }
    if (emit.declaration) {
      const declaration = replaceOutputExtension(emit.outFile, ".d.ts");
      files.add(declaration);
      if (emit.declarationMap) files.add(`${declaration}.map`);
    }
  }
  if (emit.incremental) {
    files.add(defaultTsBuildInfoFile(project, emit));
  }
  return {
    directories: [...directories],
    files: [...files],
  };
}

function inferAdjacentCompilerOutputs(
  project: ITtscParsedProjectConfig,
  options: WatchTopologyOptions,
  inputs: readonly string[],
): string[] {
  const emit = effectiveCompilerEmit(project, options);
  const outputs = new Set<string>();
  for (const input of inputs) {
    const extension = path.extname(input).toLowerCase();
    if (!isCompilerEmittableSourceExtension(extension)) {
      continue;
    }
    if (/\.d\.(?:ts|mts|cts)$/i.test(input)) continue;
    const stem = input.slice(0, -extension.length);
    if (
      emit.javascript &&
      emit.outDir === undefined &&
      emit.outFile === undefined &&
      (!isJavaScriptSourceExtension(extension) ||
        (extension === ".jsx" && emit.jsx !== "preserve"))
    ) {
      const javascriptExtension =
        extension === ".mts"
          ? ".mjs"
          : extension === ".cts"
            ? ".cjs"
            : extension === ".tsx" && emit.jsx === "preserve"
              ? ".jsx"
              : ".js";
      const javascript = stem + javascriptExtension;
      outputs.add(javascript);
      if (emit.sourceMap) outputs.add(`${javascript}.map`);
    }
    if (
      emit.declaration &&
      emit.outDir === undefined &&
      emit.declarationDir === undefined &&
      emit.outFile === undefined
    ) {
      const declarationExtension =
        extension === ".mts" || extension === ".mjs"
          ? ".d.mts"
          : extension === ".cts" || extension === ".cjs"
            ? ".d.cts"
            : ".d.ts";
      const declaration = stem + declarationExtension;
      outputs.add(declaration);
      if (emit.declarationMap) outputs.add(`${declaration}.map`);
    }
  }
  return [...outputs];
}

function isCompilerEmittableSourceExtension(extension: string): boolean {
  return [
    ".cjs",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".mts",
    ".ts",
    ".tsx",
  ].includes(extension);
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
  outFile?: string;
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
  const cliOutFile = passthroughPathOption(passthrough, "--outFile");
  const cliRootDir = passthroughPathOption(passthrough, "--rootDir");
  const cliTsBuildInfoFile = passthroughPathOption(
    passthrough,
    "--tsBuildInfoFile",
  );
  const jsx =
    passthroughStringOption(passthrough, "--jsx") ?? compilerOptions.jsx;
  return {
    declaration,
    declarationDir:
      cliDeclarationDir === null
        ? undefined
        : cliDeclarationDir !== undefined
          ? path.resolve(options.cwd, cliDeclarationDir)
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
          ? path.resolve(options.cwd, cliOutDir)
          : options.outDir !== undefined
            ? path.resolve(options.cwd, options.outDir)
            : typeof compilerOptions.outDir === "string"
              ? path.resolve(compilerOptions.outDir)
              : undefined,
    outFile:
      cliOutFile === null
        ? undefined
        : cliOutFile !== undefined
          ? path.resolve(options.cwd, cliOutFile)
          : typeof compilerOptions.outFile === "string"
            ? path.resolve(compilerOptions.outFile)
            : undefined,
    rootDir:
      cliRootDir === null
        ? undefined
        : cliRootDir !== undefined
          ? path.resolve(options.cwd, cliRootDir)
          : typeof compilerOptions.rootDir === "string"
            ? path.resolve(compilerOptions.rootDir)
            : undefined,
    sourceMap,
    tsBuildInfoFile:
      cliTsBuildInfoFile === null
        ? undefined
        : cliTsBuildInfoFile !== undefined
          ? path.resolve(options.cwd, cliTsBuildInfoFile)
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

function isCompilerOutput(
  file: string,
  outputs: { directories: readonly string[]; files: readonly string[] },
): boolean {
  return (
    outputs.files.some((output) => pathKey(output) === pathKey(file)) ||
    outputs.directories.some((directory) => isPathWithin(directory, file))
  );
}

function collectTopologyDirectories(
  files: Iterable<string>,
  roots: readonly string[],
): Map<string, string> {
  const directories = new Map<string, string>();
  for (const root of roots) {
    directories.set(pathKey(root), root);
  }
  for (const file of files) {
    const directory = path.dirname(file);
    const root = roots.find((candidate) => isPathWithin(candidate, directory));
    if (root === undefined) {
      directories.set(pathKey(directory), directory);
      continue;
    }
    let current = directory;
    while (true) {
      directories.set(pathKey(current), current);
      if (pathKey(current) === pathKey(root)) break;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return directories;
}

function collectInputDirectories(input: string): string[] {
  if (isDirectory(input) === false) return [];
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
      if (entry.isDirectory()) {
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

function isDirectory(location: string): boolean {
  try {
    return fs.statSync(location).isDirectory();
  } catch {
    return false;
  }
}

type SynchronizedWatcher = {
  close(): void;
  on(event: "error", listener: (error: Error) => void): unknown;
};

export function syncWatchers<T extends SynchronizedWatcher>(
  watchers: Map<string, T>,
  desired: ReadonlyMap<string, string>,
  create: (location: string, key: string) => T,
  onError: (location: string, error: unknown) => void,
): boolean {
  let complete = true;
  for (const [key, location] of desired) {
    if (watchers.has(key)) continue;
    try {
      const watcher = create(location, key);
      watcher.on("error", (error) => {
        if (watchers.get(key) === watcher) {
          watchers.delete(key);
        }
        watcher.close();
        onError(location, error);
      });
      watchers.set(key, watcher);
    } catch (error) {
      complete = false;
      onError(location, error);
    }
  }
  if (!complete) return false;
  for (const [key, watcher] of watchers) {
    if (desired.has(key)) continue;
    watcher.close();
    watchers.delete(key);
  }
  return true;
}

function closeWatchers(watchers: Map<string, fs.FSWatcher>): void {
  for (const watcher of watchers.values()) watcher.close();
  watchers.clear();
}

function addPaths(target: Map<string, string>, paths: Iterable<string>): void {
  for (const location of paths) {
    const resolved = path.resolve(location);
    target.set(pathKey(resolved), resolved);
  }
}

function uniqueExistingPaths(paths: readonly string[]): string[] {
  const unique = new Map<string, string>();
  for (const location of paths) {
    if (location.length === 0) continue;
    const resolved = path.resolve(location);
    unique.set(pathKey(resolved), resolved);
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
  return (
    resolveProjectInputPath(left.root || ".") ===
      resolveProjectInputPath(right.root || ".") &&
    arraysEqual(left.files, right.files) &&
    arraysEqual(left.globs, right.globs) &&
    arraysEqual(left.reloadDirectories ?? [], right.reloadDirectories ?? []) &&
    arraysEqual(left.reloadFiles ?? [], right.reloadFiles ?? [])
  );
}

export function literalGlobRoot(pattern: string): string {
  const resolved = path.resolve(pattern);
  const normalized = resolved.split("\\").join("/");
  const wildcard = normalized.search(/[*?]/);
  if (wildcard === -1) return path.dirname(resolved);
  const separator = normalized.lastIndexOf("/", wildcard);
  const prefix = separator < 0 ? "." : normalized.slice(0, separator);
  const volumeRoot = path.parse(resolved).root;
  const normalizedVolumeRoot = volumeRoot.split("\\").join("/");
  if (
    prefix.length === 0 ||
    prefix === normalizedVolumeRoot.replace(/\/$/, "")
  ) {
    return volumeRoot;
  }
  return path.resolve(prefix);
}

function projectInputDeclarationKey(
  kind: "file" | "glob" | "reload" | "reload-directory",
  declaration: string,
): string {
  return `${kind}\0${resolveProjectInputPath(declaration)}`;
}

/**
 * Chooses the one stable recursive watcher root owned by a project-input
 * declaration.
 *
 * Inputs inside the project share its physical root so directory replacement
 * cannot strand a child handle. External inputs use the nearest existing
 * ancestor of their declared parent, which is the explicit boundary for
 * observing a currently missing external tree without polling every file.
 */
export function projectInputWatchDirectories(
  target: string,
  projectRoot: string,
): string[] {
  const root = projectInputRecursiveWatchRoot(target, projectRoot);
  return root === undefined ? [] : [root];
}

/**
 * Removes recursive roots already covered by an ancestor without rewriting the
 * declaration-specific roots retained by WatchTopology.
 */
export function projectInputActiveWatchDirectories(
  directories: Iterable<string>,
  identities = createProjectInputPathIdentityContext(),
): string[] {
  const unique = new Map<string, string>();
  for (const directory of directories) {
    const identity = identities.resolve(directory);
    unique.set(identity.key, identity.path);
  }
  return [...unique]
    .filter(([key]) => {
      let ancestor = path.dirname(key);
      while (ancestor !== key) {
        if (unique.has(ancestor)) return false;
        const parent = path.dirname(ancestor);
        if (parent === ancestor) break;
        ancestor = parent;
      }
      return true;
    })
    .map(([, directory]) => directory);
}

export function projectInputAvailableWatchDirectory(
  location: string,
  rejected: ReadonlySet<string>,
  identities: ProjectInputPathIdentityContext = createProjectInputPathIdentityContext(),
): string | undefined {
  let current = path.resolve(location);
  while (true) {
    const identity = identities.resolve(current);
    if (!rejected.has(identity.key)) return identity.path;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    const fallback = nearestExistingDirectory(parent);
    if (fallback === undefined) return undefined;
    current = fallback;
  }
}

function projectInputRecursiveWatchRoot(
  target: string,
  projectRoot: string,
  identities = createProjectInputPathIdentityContext(),
): string | undefined {
  const resolvedTarget = path.resolve(target);
  const resolvedProjectRoot = path.resolve(projectRoot);
  if (identities.isWithin(resolvedProjectRoot, resolvedTarget)) {
    return nearestExistingDirectory(resolvedProjectRoot);
  }
  return nearestExistingDirectory(path.dirname(resolvedTarget));
}

function nearestExistingDirectory(location: string): string | undefined {
  let current = path.resolve(location);
  while (true) {
    if (isDirectory(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
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

function projectInputTopologyMayAffect(
  snapshot: ITtscProjectInputSnapshot,
  location: string,
  previous: ReadonlyMap<string, string>,
  identities = createProjectInputPathIdentityContext(),
): boolean {
  const changed = path.resolve(location);
  return (
    snapshot.files.some((file) => identities.isWithin(changed, file)) ||
    (snapshot.reloadFiles ?? []).some((file) =>
      identities.isWithin(changed, file),
    ) ||
    (snapshot.reloadDirectories ?? []).some((directory) =>
      identities.isWithin(directory, changed),
    ) ||
    snapshot.globs.some((glob) => {
      const root = literalGlobRoot(glob);
      if (identities.isWithin(changed, root)) return true;
      if (identities.isWithin(root, changed) === false) return false;
      if (isDirectory(changed)) return true;
      return [...previous.values()].some((input) =>
        identities.isWithin(changed, input),
      );
    })
  );
}

export function projectInputEventShouldNotify(input: {
  contentChanged: boolean;
  directlyMatched: boolean;
  membershipChanged: boolean;
}): boolean {
  return input.contentChanged || input.membershipChanged;
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

/**
 * Classify an exact execution-selection input ahead of ordinary project data.
 *
 * `changedInputs` carries fingerprint or membership deltas, so a filename-less
 * event can still select the cold lane. A named exact event selects the cold
 * lane only after the surrounding change detector admits the event; unchanged
 * bytes remain quiet before this classifier is observed.
 */
export function projectInputReloadEventShouldNotify(input: {
  changed?: string;
  changedInputs: readonly string[];
  reloadDirectories?: readonly string[];
  reloadFiles: readonly string[];
}): boolean {
  const identities = createProjectInputPathIdentityContext();
  const reloadFiles = new Set(
    input.reloadFiles.map((location) => identities.resolve(location).key),
  );
  const reloadDirectories = (input.reloadDirectories ?? []).map((location) =>
    identities.resolve(location),
  );
  const isReloadDirectoryInput = (location: string): boolean =>
    reloadDirectories.some((directory) =>
      identities.isWithin(directory.path, location),
    );
  return (
    (input.changed !== undefined &&
      (reloadFiles.has(identities.resolve(input.changed).key) ||
        isReloadDirectoryInput(input.changed))) ||
    input.changedInputs.some(
      (location) =>
        reloadFiles.has(identities.resolve(location).key) ||
        isReloadDirectoryInput(location),
    )
  );
}

/**
 * Return whether a project-input population transition can reshape a Program.
 *
 * JSON is data to a ProjectRule but may simultaneously be a `resolveJsonModule`
 * source. TypeScript and JavaScript paths can likewise overlap a project-input
 * declaration. Their creation or deletion therefore requires a cold Program
 * inside the existing resident process. A filename-less event cannot identify
 * the changed member and is conservatively invalidating whenever the population
 * moved.
 */
export function projectInputMembershipInvalidatesProgram(input: {
  changed?: string;
  changedInputs?: readonly string[];
  contentChanged?: boolean;
  next: ReadonlyMap<string, string>;
  previous: ReadonlyMap<string, string>;
}): boolean {
  if (
    input.contentChanged === true &&
    (
      input.changedInputs ??
      (input.changed === undefined ? [] : [input.changed])
    ).some(
      (location) => path.basename(location).toLowerCase() === "package.json",
    )
  ) {
    return true;
  }
  if (mapsEqual(input.previous, input.next)) return false;
  if (input.changed === undefined) return true;
  for (const [key, location] of input.previous) {
    if (
      input.next.has(key) === false &&
      projectInputPathMayAffectProgram(location)
    ) {
      return true;
    }
  }
  for (const [key, location] of input.next) {
    if (
      input.previous.has(key) === false &&
      projectInputPathMayAffectProgram(location)
    ) {
      return true;
    }
  }
  return false;
}

function projectInputPathMayAffectProgram(location: string): boolean {
  const extension = path.extname(location).toLowerCase();
  return extension === ".json" || isCompilerEmittableSourceExtension(extension);
}

function projectInputCompilerMembershipChange(
  snapshot: ITtscProjectInputSnapshot,
  previous: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>,
): string[] | undefined {
  const changed = new Map<string, string>();
  for (const [key, location] of previous) {
    if (next.has(key) === false) changed.set(key, location);
  }
  for (const [key, location] of next) {
    if (previous.has(key) === false) changed.set(key, location);
  }
  if (
    changed.size === 0 ||
    [...changed.values()].some(
      (location) =>
        matchesProjectInput(snapshot, location) === false ||
        projectInputPathMayAffectProgram(location) === false,
    )
  ) {
    return undefined;
  }
  return [...changed.values()].sort();
}

function fingerprintProjectInputMatches(
  matches: ReadonlyMap<string, string>,
): Map<string, string> {
  const fingerprints = new Map<string, string>();
  for (const [key, location] of matches) {
    try {
      fingerprints.set(
        key,
        isDirectory(location)
          ? fingerprintProjectInputDirectory(location)
          : crypto
              .createHash("sha256")
              .update(fs.readFileSync(location))
              .digest("hex"),
      );
    } catch {
      fingerprints.set(key, "");
    }
  }
  return fingerprints;
}

function fingerprintProjectInputDirectory(location: string): string {
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

function mapsEqual(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
): boolean {
  if (left.size !== right.size) return false;
  return [...left].every(([key, value]) => right.get(key) === value);
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length && left.every((value, i) => value === right[i])
  );
}

function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false &&
      !path.isAbsolute(relative))
  );
}

/**
 * Plan one compiler-directory event without relying on backend timing.
 *
 * POSIX file watchers own ordinary content changes. A named rename re-arms the
 * replaced file; an unnamed event conservatively re-arms and reports every
 * surviving tracked input below the watch root. Windows has no per-file
 * watchers here, so both named and unnamed directory events report inputs.
 */
export function planCompilerDirectoryWatchEvent(input: {
  changed?: string;
  event: string;
  exists(location: string): boolean;
  location: string;
  platform: NodeJS.Platform;
  trackedFiles: ReadonlyMap<string, string>;
}): CompilerDirectoryWatchEventPlan {
  const candidates =
    input.changed === undefined
      ? [...input.trackedFiles.values()].filter(
          (file) =>
            input.exists(file) &&
            isPathWithin(input.location, path.resolve(file)),
        )
      : input.trackedFiles.has(
            pathKeyForPlatform(input.changed, input.platform),
          ) && input.exists(input.changed)
        ? [input.changed]
        : [];
  if (input.changed === undefined) {
    return {
      changes: candidates,
      rearm: input.platform === "win32" ? [] : candidates,
      refresh: true,
    };
  }
  if (candidates.length === 0) {
    return { changes: [], rearm: [], refresh: true };
  }
  if (input.platform === "win32") {
    return { changes: candidates, rearm: [], refresh: false };
  }
  if (input.event === "rename") {
    return { changes: candidates, rearm: candidates, refresh: false };
  }
  return { changes: [], rearm: [], refresh: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pathKey(location: string): string {
  return pathKeyForPlatform(location, process.platform);
}

function pathKeyForPlatform(
  location: string,
  platform: NodeJS.Platform,
): string {
  const resolved = path.resolve(location);
  return platform === "win32" ? resolved.toLowerCase() : resolved;
}
