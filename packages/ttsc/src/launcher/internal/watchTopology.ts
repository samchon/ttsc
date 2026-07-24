import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { readJsoncFile } from "../../compiler/internal/project/readConfigJson";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { outputText, spawnNative } from "../../compiler/internal/spawnNative";
import { resolveFlagSpec } from "../../flags/schema";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectInputSnapshot } from "../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildOptions } from "../../structures/internal/TtscBuildOptions";

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
  onTopologyChange(): void;
};

export type WatchInputChange = {
  kind: "compiler" | "config" | "plugin" | "project";
  path?: string;
};

type ResolvedWatchTopology = {
  directories: Map<string, string>;
  files: Map<string, string>;
  outputFiles: Map<string, string>;
  outputs: Map<string, string>;
  reloadFiles: Map<string, string>;
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
    root: "",
  };
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
    const changed =
      mapsEqual(this.files, next.files) === false ||
      mapsEqual(this.directories, next.directories) === false ||
      mapsEqual(this.outputFiles, next.outputFiles) === false ||
      mapsEqual(this.outputs, next.outputs) === false ||
      mapsEqual(this.reloadFiles, next.reloadFiles) === false;
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
      this.callbacks.onTopologyChange();
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
    const declarations = new Set([
      ...next.files.map((file) => projectInputDeclarationKey("file", file)),
      ...next.globs.map((glob) => projectInputDeclarationKey("glob", glob)),
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
            kind: this.reloadFiles.has(pathKey(location))
              ? "config"
              : "compiler",
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
          (_event, filename) => {
            const changed =
              filename === null
                ? undefined
                : path.resolve(location, filename.toString());
            // File watchers own ordinary source/config edits. Directory watchers
            // only reconcile membership, so an emit in an unrelated output folder
            // cannot schedule another build.
            if (
              changed !== undefined &&
              this.files.has(pathKey(changed)) &&
              fs.existsSync(changed)
            ) {
              if (process.platform === "win32") {
                this.callbacks.onInputChange({
                  kind: this.reloadFiles.has(pathKey(changed))
                    ? "config"
                    : "compiler",
                  path: changed,
                });
              }
              return;
            }
            this.refreshFromDirectory(location, changed);
          },
        ),
      (location, error) => this.callbacks.onError(location, error),
    );
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
        fs.watch(location, { persistent: true }, () => {
          this.callbacks.onInputChange({
            kind: "plugin",
            path: location,
          });
        }),
      (location, error) => this.callbacks.onError(location, error),
    );
  }

  private syncProjectInputWatchers(): void {
    const desired = new Map<string, string>();
    for (const file of this.projectInputs.files) {
      if (this.isCompilerOutput(file)) continue;
      const location = this.projectInputWatchRoot(
        "file",
        file,
        path.dirname(file),
      );
      if (location !== undefined) desired.set(pathKey(location), location);
    }
    for (const glob of this.projectInputs.globs) {
      const root = literalGlobRoot(glob);
      if (this.isCompilerOutputDirectory(root)) continue;
      const location = this.projectInputWatchRoot("glob", glob, root);
      if (location !== undefined) desired.set(pathKey(location), location);
    }
    const active = new Map<string, string>();
    addPaths(active, projectInputActiveWatchDirectories(desired.values()));
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
      (location, error) => this.callbacks.onError(location, error),
    );
  }

  private projectInputWatchRoot(
    kind: "file" | "glob",
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
      const directlyMatched =
        changed !== undefined &&
        (previous.has(pathKey(changed)) ||
          matchesProjectInput(this.projectInputs, changed));
      const topologyMatched =
        changed !== undefined &&
        projectInputTopologyMayAffect(this.projectInputs, changed, previous);
      if (
        changed !== undefined &&
        (this.isCompilerOutput(changed) ||
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
      this.projectInputMatches = next;
      this.projectInputFingerprints = nextFingerprints;
      this.syncProjectInputWatchers();
      if (
        projectInputEventShouldNotify({
          contentChanged,
          directlyMatched,
          membershipChanged,
        }) &&
        (changed === undefined || this.isCompilerOutput(changed) === false)
      ) {
        this.callbacks.onInputChange({
          kind: "project",
          path: changed,
        });
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
    const matches = new Map<string, string>();
    for (const file of this.projectInputs.files) {
      if (fs.existsSync(file) && this.isCompilerOutput(file) === false) {
        matches.set(pathKey(file), file);
      }
    }
    for (const glob of this.projectInputs.globs) {
      const root = literalGlobRoot(glob);
      if (isDirectory(root) === false || this.isCompilerOutputDirectory(root)) {
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
          if (this.isCompilerOutput(location)) continue;
          if (entry.isDirectory()) {
            stack.push(location);
          } else if (
            entry.isFile() &&
            matchesProjectInputGlob(glob, location)
          ) {
            matches.set(pathKey(location), location);
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

  private isProjectInputDirectory(location: string): boolean {
    const resolved = path.resolve(location);
    return (
      this.projectInputs.files.some(
        (file) =>
          isPathWithin(resolved, file) ||
          isPathWithin(path.dirname(file), resolved),
      ) ||
      this.projectInputs.globs.some((glob) => {
        const root = literalGlobRoot(glob);
        return isPathWithin(root, resolved) || isPathWithin(resolved, root);
      })
    );
  }
}

function resolveWatchTopology(
  options: WatchTopologyOptions,
  extraInputs: readonly string[],
): ResolvedWatchTopology {
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
    roots.push(project.root);
    addPaths(files, project.configPaths);
    addPaths(reloadFiles, project.configPaths);
    const compilerOutputs = resolveCompilerOutputs(project, options);
    addPaths(outputFiles, compilerOutputs.files);
    addPaths(
      outputFiles,
      inferAdjacentCompilerOutputs(
        project,
        options,
        options.files.map((file) => path.resolve(options.cwd, file)),
      ),
    );
    addPaths(outputs, compilerOutputs.directories);
    addPaths(
      files,
      options.files.map((file) => path.resolve(options.cwd, file)),
    );
  } else {
    for (const project of readReferencedProjects(options)) {
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
    directories: collectTopologyDirectories(files.values(), roots),
    files,
    outputFiles,
    outputs,
    reloadFiles,
  };
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
    if (!isPathWithin(project.root, input)) continue;
    const extension = path.extname(input).toLowerCase();
    if (
      extension !== ".ts" &&
      extension !== ".tsx" &&
      extension !== ".mts" &&
      extension !== ".cts"
    ) {
      continue;
    }
    if (/\.d\.(?:ts|mts|cts)$/i.test(input)) continue;
    const stem = input.slice(0, -extension.length);
    if (
      emit.javascript &&
      emit.outDir === undefined &&
      emit.outFile === undefined
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
        extension === ".mts"
          ? ".d.mts"
          : extension === ".cts"
            ? ".d.cts"
            : ".d.ts";
      const declaration = stem + declarationExtension;
      outputs.add(declaration);
      if (emit.declarationMap) outputs.add(`${declaration}.map`);
    }
  }
  return [...outputs];
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
      emitDeclarationOnly ||
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
  const cliOutDir =
    passthroughPathOption(passthrough, "--outDir") ?? options.outDir;
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
      cliDeclarationDir !== undefined
        ? path.resolve(options.cwd, cliDeclarationDir)
        : typeof compilerOptions.declarationDir === "string"
          ? path.resolve(compilerOptions.declarationDir)
          : undefined,
    declarationMap,
    incremental,
    javascript,
    outDir:
      cliOutDir !== undefined
        ? path.resolve(options.cwd, cliOutDir)
        : typeof compilerOptions.outDir === "string"
          ? path.resolve(compilerOptions.outDir)
          : undefined,
    outFile:
      cliOutFile !== undefined
        ? path.resolve(options.cwd, cliOutFile)
        : typeof compilerOptions.outFile === "string"
          ? path.resolve(compilerOptions.outFile)
          : undefined,
    rootDir:
      cliRootDir !== undefined
        ? path.resolve(options.cwd, cliRootDir)
        : typeof compilerOptions.rootDir === "string"
          ? path.resolve(compilerOptions.rootDir)
          : undefined,
    sourceMap,
    tsBuildInfoFile:
      cliTsBuildInfoFile !== undefined
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
  if (emit.outFile !== undefined) {
    return replaceOutputExtension(emit.outFile, ".tsbuildinfo");
  }
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
    const equalsIndex = token.indexOf("=");
    if (!passthroughOptionMatches(token, name)) continue;
    if (equalsIndex === -1) {
      const next = tokens?.[index + 1]?.toLowerCase();
      if (next === "true" || next === "false") {
        value = next === "true";
        index++;
      } else {
        value = true;
      }
    } else {
      const inline = token.slice(equalsIndex + 1).toLowerCase();
      if (inline === "true" || inline === "false") value = inline === "true";
    }
  }
  return value;
}

function passthroughPathOption(
  tokens: readonly string[] | undefined,
  name: string,
): string | undefined {
  let value: string | undefined;
  for (let index = 0; index < (tokens?.length ?? 0); index++) {
    const token = tokens?.[index];
    if (token === undefined) continue;
    const equalsIndex = token.indexOf("=");
    if (!passthroughOptionMatches(token, name)) continue;
    if (equalsIndex === -1 && index + 1 < (tokens?.length ?? 0)) {
      value = tokens?.[++index];
    } else if (equalsIndex !== -1) {
      value = token.slice(equalsIndex + 1);
    }
  }
  return value;
}

function passthroughStringOption(
  tokens: readonly string[] | undefined,
  name: string,
): string | undefined {
  return passthroughPathOption(tokens, name)?.toLowerCase();
}

function passthroughOptionMatches(token: string, name: string): boolean {
  if (!token.startsWith("-")) return false;
  const equalsIndex = token.indexOf("=");
  const spelling = equalsIndex === -1 ? token : token.slice(0, equalsIndex);
  return resolveFlagSpec(spelling)?.name === resolveFlagSpec(name)?.name;
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

function syncWatchers(
  watchers: Map<string, fs.FSWatcher>,
  desired: ReadonlyMap<string, string>,
  create: (location: string, key: string) => fs.FSWatcher,
  onError: (location: string, error: unknown) => void,
): void {
  for (const [key, watcher] of watchers) {
    if (desired.has(key)) continue;
    watcher.close();
    watchers.delete(key);
  }
  for (const [key, location] of desired) {
    if (watchers.has(key)) continue;
    try {
      const watcher = create(location, key);
      watcher.on("error", (error) => onError(location, error));
      watchers.set(key, watcher);
    } catch (error) {
      onError(location, error);
    }
  }
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
  const files = new Map<string, string>();
  const globs = new Map<string, string>();
  for (const file of snapshot.files) {
    const resolved = path.resolve(file);
    files.set(pathKey(resolved), resolved);
  }
  for (const glob of snapshot.globs) {
    const normalized = path.resolve(glob).split(path.sep).join("/");
    globs.set(projectInputPatternKey(normalized), normalized);
  }
  return {
    files: [...files.values()].sort(),
    globs: [...globs.values()].sort(),
    root: path.resolve(snapshot.root),
  };
}

function projectInputSnapshotsEqual(
  left: ITtscProjectInputSnapshot,
  right: ITtscProjectInputSnapshot,
): boolean {
  return (
    pathKey(left.root || ".") === pathKey(right.root || ".") &&
    arraysEqual(left.files, right.files) &&
    arraysEqual(left.globs, right.globs)
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
  kind: "file" | "glob",
  declaration: string,
): string {
  return `${kind}\0${projectInputPatternKey(declaration)}`;
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
): string[] {
  const unique = new Map<string, string>();
  for (const directory of directories) {
    const resolved = path.resolve(directory);
    unique.set(pathKey(resolved), resolved);
  }
  return [...unique]
    .filter(([key, directory]) =>
      [...unique].every(
        ([candidateKey, candidate]) =>
          candidateKey === key || isPathWithin(candidate, directory) === false,
      ),
    )
    .map(([, directory]) => directory);
}

function projectInputRecursiveWatchRoot(
  target: string,
  projectRoot: string,
): string | undefined {
  const resolvedTarget = path.resolve(target);
  const resolvedProjectRoot = path.resolve(projectRoot);
  if (isPathWithin(resolvedProjectRoot, resolvedTarget)) {
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
): boolean {
  const key = pathKey(location);
  return (
    snapshot.files.some((file) => pathKey(file) === key) ||
    snapshot.globs.some((glob) => matchesProjectInputGlob(glob, location))
  );
}

function projectInputTopologyMayAffect(
  snapshot: ITtscProjectInputSnapshot,
  location: string,
  previous: ReadonlyMap<string, string>,
): boolean {
  const changed = path.resolve(location);
  return (
    snapshot.files.some((file) => isPathWithin(changed, file)) ||
    snapshot.globs.some((glob) => {
      const root = literalGlobRoot(glob);
      if (isPathWithin(changed, root)) return true;
      if (isPathWithin(root, changed) === false) return false;
      if (isDirectory(changed)) return true;
      return [...previous.values()].some((input) =>
        isPathWithin(changed, input),
      );
    })
  );
}

export function projectInputEventShouldNotify(input: {
  contentChanged: boolean;
  directlyMatched: boolean;
  membershipChanged: boolean;
}): boolean {
  return (
    input.contentChanged || input.directlyMatched || input.membershipChanged
  );
}

function fingerprintProjectInputMatches(
  matches: ReadonlyMap<string, string>,
): Map<string, string> {
  const fingerprints = new Map<string, string>();
  for (const [key, location] of matches) {
    try {
      fingerprints.set(
        key,
        crypto
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

function matchesProjectInputGlob(pattern: string, location: string): boolean {
  const normalize = (value: string): string => {
    const normalized = path.resolve(value).split(path.sep).join("/");
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  return matchProjectInputGlobParts(
    normalize(pattern).split("/"),
    normalize(location).split("/"),
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

function projectInputPatternKey(pattern: string): string {
  return process.platform === "win32" ? pattern.toLowerCase() : pattern;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pathKey(location: string): string {
  const resolved = path.resolve(location);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
