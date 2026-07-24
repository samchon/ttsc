import fs from "node:fs";
import path from "node:path";

import { readJsoncFile } from "../../compiler/internal/project/readConfigJson";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { outputText, spawnNative } from "../../compiler/internal/spawnNative";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { TtscBuildOptions } from "../../structures/internal/TtscBuildOptions";

type WatchTopologyOptions = Pick<
  TtscBuildOptions,
  "binary" | "env" | "outDir" | "passthrough" | "projectRoot" | "tsconfig"
> & {
  cwd: string;
  files: readonly string[];
};

type WatchTopologyCallbacks = {
  onError(location: string, error: unknown): void;
  onInputChange(): void;
  onTopologyChange(): void;
};

type ResolvedWatchTopology = {
  directories: Map<string, string>;
  files: Map<string, string>;
  outputs: Map<string, string>;
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
  private outputs = new Map<string, string>();

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
      mapsEqual(this.outputs, next.outputs) === false;
    this.files = next.files;
    this.directories = next.directories;
    this.outputs = next.outputs;
    this.syncFileWatchers();
    this.syncDirectoryWatchers();
    this.syncExtraWatchers();
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

  /** Close every watcher so SIGINT/SIGTERM can drain the event loop. */
  public close(): void {
    closeWatchers(this.fileWatchers);
    closeWatchers(this.directoryWatchers);
    closeWatchers(this.extraWatchers);
  }

  private syncFileWatchers(): void {
    syncWatchers(
      this.fileWatchers,
      this.files,
      (location) =>
        fs.watch(location, { persistent: true }, () => {
          this.callbacks.onInputChange();
        }),
      (location, error) => this.callbacks.onError(location, error),
    );
  }

  private syncDirectoryWatchers(): void {
    const desired = new Map(this.directories);
    for (const [key, location] of this.observedDirectories) {
      if (
        isDirectory(location) === false ||
        this.isCompilerOutputDirectory(location)
      ) {
        this.observedDirectories.delete(key);
        continue;
      }
      desired.set(key, location);
    }
    syncWatchers(
      this.directoryWatchers,
      desired,
      (location) =>
        fs.watch(location, { persistent: true }, (_event, filename) => {
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
            return;
          }
          this.refreshFromDirectory(location, changed);
        }),
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
          this.callbacks.onInputChange();
        }),
      (location, error) => this.callbacks.onError(location, error),
    );
  }

  private refreshFromDirectory(location: string, changed?: string): void {
    if (
      changed !== undefined &&
      isDirectory(changed) &&
      this.isCompilerOutputDirectory(changed) === false
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
}

function resolveWatchTopology(
  options: WatchTopologyOptions,
  extraInputs: readonly string[],
): ResolvedWatchTopology {
  const files = new Map<string, string>();
  const outputs = new Map<string, string>();
  const roots: string[] = [];
  if (options.files.length !== 0) {
    const project = readProjectConfig({
      cwd: options.cwd,
      projectRoot: options.projectRoot,
      tsconfig: options.tsconfig,
    });
    roots.push(project.root);
    addPaths(files, project.configPaths);
    addPaths(outputs, resolveCompilerOutputs(project, options).directories);
    addPaths(
      files,
      options.files.map((file) => path.resolve(options.cwd, file)),
    );
  } else {
    for (const project of readReferencedProjects(options)) {
      roots.push(project.root);
      addPaths(files, project.configPaths);
      addPaths(outputs, resolveCompilerOutputs(project, options).directories);
      addPaths(files, listCompilerInputs(project, options));
    }
  }
  addPaths(files, extraInputs);
  return {
    directories: collectTopologyDirectories(files.values(), roots),
    files,
    outputs,
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
  const compilerOptions = project.compilerOptions;
  const outDir = options.outDir
    ? path.resolve(options.cwd, options.outDir)
    : compilerOptions.outDir;
  return {
    directories: [outDir, compilerOptions.declarationDir]
      .filter((value): value is string => typeof value === "string")
      .map((value) => path.resolve(value)),
    files: [compilerOptions.outFile, compilerOptions.tsBuildInfoFile]
      .filter((value): value is string => typeof value === "string")
      .map((value) => path.resolve(project.root, value)),
  };
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
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      }
    }
  }
  return directories;
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
  create: (location: string) => fs.FSWatcher,
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
      const watcher = create(location);
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
