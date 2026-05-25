import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export type ResolutionCandidate = {
  cwd: string;
  resolveFrom: string;
  tsconfig?: string;
};

export type ResolutionCandidateInput = {
  activeFile?: string;
  activeWorkspaceRoot?: string;
  workspaceRoots?: readonly string[];
};

export type ServerProcessOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
};

export type ServerLaunchCommand = {
  args: string[];
  command: string;
};

export type ClientRootSelection = {
  file: string;
  root: string;
};

export type RelativePatternConstructor<T> = new (
  base: string,
  pattern: string,
) => T;

const PROJECT_CONFIG_PATTERN = /^(?:tsconfig|jsconfig)(?:\..*)?\.json$/;
const WRAPPED_COMMAND_IDS = ["ttsc.lint.fixAll", "ttsc.format.document"];

/**
 * Resolve the workspace-owned ttscserver launcher without requiring ttsc to
 * export its internal lib path. The package.json subpath is exported, so it is
 * a stable anchor for locating the sibling launcher file on disk.
 */
export function resolveTtscServerLauncher(
  resolveFrom: string,
): string | undefined {
  try {
    const requireFromBase = createRequire(
      path.join(resolveFrom, "__ttsc_vscode_resolve__.cjs"),
    );
    const packageJson = requireFromBase.resolve("ttsc/package.json");
    const packageRoot = path.dirname(packageJson);
    const manifest = JSON.parse(fs.readFileSync(packageJson, "utf8")) as {
      bin?: { ttscserver?: unknown };
    };
    const bin =
      typeof manifest.bin?.ttscserver === "string"
        ? manifest.bin.ttscserver
        : path.join("lib", "launcher", "ttscserver.js");
    const launcher = path.resolve(packageRoot, bin);
    return fs.existsSync(launcher) ? launcher : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Walk upward from an active document or workspace folder until a TypeScript
 * project config is found. `stopAt` prevents a nested package from escaping its
 * owning workspace root.
 */
export function findProjectRoot(
  start: string,
  stopAt?: string,
): string | undefined {
  const config = findProjectConfig(start, stopAt);
  return config ? path.dirname(config) : undefined;
}

export function findProjectConfig(
  start: string,
  stopAt?: string,
): string | undefined {
  let dir = path.resolve(start);
  const boundary = stopAt ? path.resolve(stopAt) : undefined;
  for (;;) {
    const config = projectConfigIn(dir);
    if (config) {
      return config;
    }
    if (boundary && dir === boundary) {
      return undefined;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

export function createResolutionCandidates(
  input: ResolutionCandidateInput,
): ResolutionCandidate[] {
  const candidates: ResolutionCandidate[] = [];
  const seen = new Set<string>();
  const push = (candidate: ResolutionCandidate) => {
    const key = `${candidate.resolveFrom}\0${candidate.cwd}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  if (input.activeFile) {
    const resolveFrom = path.dirname(input.activeFile);
    const tsconfig = findProjectConfig(resolveFrom, input.activeWorkspaceRoot);
    push({
      cwd: tsconfig
        ? path.dirname(tsconfig)
        : (input.activeWorkspaceRoot ?? resolveFrom),
      resolveFrom,
      tsconfig,
    });
  }
  for (const root of input.workspaceRoots ?? []) {
    const tsconfig = findProjectConfig(root, root);
    push({
      cwd: tsconfig ? path.dirname(tsconfig) : root,
      resolveFrom: root,
      tsconfig,
    });
  }
  return candidates;
}

export function createServerLaunchCommand(
  launcher: string,
  candidate: ResolutionCandidate,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): ServerLaunchCommand {
  const args = [
    "--stdio",
    "--cwd=" + candidate.cwd,
    "--suppress-execute-command-ids=" + WRAPPED_COMMAND_IDS.join(","),
    "--execute-command-id-prefix=" + executeCommandIDPrefix(candidate.cwd),
    ...(candidate.tsconfig ? ["--tsconfig=" + candidate.tsconfig] : []),
  ];
  if (isJavaScriptLauncher(launcher)) {
    return { command: process.execPath, args: [launcher, ...args] };
  }
  if (platform === "win32" && isWindowsCommandLauncher(launcher)) {
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", quoteWindowsCommand([launcher, ...args])],
    };
  }
  return { command: launcher, args };
}

export function quoteWindowsCommand(args: readonly string[]): string {
  return `"${args.map(quoteWindowsArg).join(" ")}"`;
}

export function createDocumentSelectorPattern<T>(
  ctor: RelativePatternConstructor<T>,
  root: string,
): T {
  return new ctor(root, "**/*");
}

export function executeCommandIDPrefix(root: string): string {
  const key = createHash("sha256")
    .update(rootKey(root))
    .digest("hex")
    .slice(0, 16);
  return `ttsc.vscode.${key}.`;
}

/** Return the absolute glob used to scope one language client to one root. */
export function documentPattern(root: string): string {
  return path.posix.join(root.replace(/\\/g, "/"), "**/*");
}

export function filterNonOverlappingCandidates(
  candidates: readonly ResolutionCandidate[],
): ResolutionCandidate[] {
  const sorted = [...candidates].sort(
    (left, right) =>
      path.resolve(right.cwd).length - path.resolve(left.cwd).length,
  );
  const selected: ResolutionCandidate[] = [];
  for (const candidate of sorted) {
    if (
      selected.some((entry) =>
        isPathInsideRoot(entry.cwd, candidate.cwd, process.platform),
      )
    ) {
      continue;
    }
    selected.push(candidate);
  }
  return selected.sort(
    (left, right) =>
      candidates.indexOf(left as ResolutionCandidate) -
      candidates.indexOf(right as ResolutionCandidate),
  );
}

export function planNonOverlappingClientRoots(
  roots: readonly string[],
  preferredRoot?: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  const unique = new Map<string, string>();
  for (const root of roots) {
    const key = rootKey(root, platform);
    if (!unique.has(key)) {
      unique.set(key, root);
    }
  }
  const preferredKey = preferredRoot
    ? rootKey(preferredRoot, platform)
    : undefined;
  const ordered: string[] = [];
  if (preferredKey && unique.has(preferredKey)) {
    ordered.push(unique.get(preferredKey)!);
    unique.delete(preferredKey);
  }
  ordered.push(
    ...[...unique.values()].sort((left, right) => {
      const depth = pathDepth(right, platform) - pathDepth(left, platform);
      return (
        depth ||
        normalizeForPathMatch(left, platform).localeCompare(
          normalizeForPathMatch(right, platform),
        )
      );
    }),
  );
  const selected: string[] = [];
  for (const root of ordered) {
    if (selected.some((entry) => rootsOverlap(entry, root, platform))) {
      continue;
    }
    selected.push(root);
  }
  return selected;
}

export function selectDeepestRootForPath(
  file: string,
  roots: readonly string[],
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  let selected: string | undefined;
  for (const root of roots) {
    if (!isPathInsideRoot(file, root, platform)) {
      continue;
    }
    if (
      !selected ||
      normalizeForPathMatch(root, platform).length >
        normalizeForPathMatch(selected, platform).length
    ) {
      selected = root;
    }
  }
  return selected;
}

export function isPathInsideRoot(
  file: string,
  root: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const normalizedFile = normalizeForPathMatch(file, platform);
  const normalizedRoot = normalizeForPathMatch(root, platform);
  const sep = platform === "win32" ? path.win32.sep : path.sep;
  return (
    normalizedFile === normalizedRoot ||
    normalizedFile.startsWith(normalizedRoot + sep)
  );
}

export function rootsOverlap(
  left: string,
  right: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return (
    isPathInsideRoot(left, right, platform) ||
    isPathInsideRoot(right, left, platform)
  );
}

export function rootsToStopForTarget(
  roots: readonly string[],
  target: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  return roots.filter((root) => rootsOverlap(root, target, platform));
}

export function rootsToStopForPlan(
  roots: readonly string[],
  plannedRoots: readonly string[],
  platform: NodeJS.Platform = process.platform,
): string[] {
  const plannedKeys = new Set(
    plannedRoots.map((root) => rootKey(root, platform)),
  );
  return roots.filter((root) => !plannedKeys.has(rootKey(root, platform)));
}

export function rootsInsideRemovedWorkspace(
  roots: readonly string[],
  removedRoot: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  return roots.filter((root) => isPathInsideRoot(root, removedRoot, platform));
}

export function rootKey(
  root: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return normalizeForPathMatch(root, platform);
}

function normalizeForPathMatch(
  value: string,
  platform: NodeJS.Platform,
): string {
  const pathApi = platform === "win32" ? path.win32 : path;
  const normalized = pathApi.resolve(value);
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

function pathDepth(value: string, platform: NodeJS.Platform): number {
  return normalizeForPathMatch(value, platform)
    .split(platform === "win32" ? path.win32.sep : path.sep)
    .filter(Boolean).length;
}

function projectConfigIn(dir: string): string | undefined {
  try {
    const match = fs
      .readdirSync(dir)
      .filter((name) => PROJECT_CONFIG_PATTERN.test(name))
      .sort(compareProjectConfigNames)[0];
    return match ? path.join(dir, match) : undefined;
  } catch {
    return undefined;
  }
}

function compareProjectConfigNames(left: string, right: string): number {
  const priority = (name: string): number => {
    if (name === "tsconfig.json") return 0;
    if (/^tsconfig\..*\.json$/.test(name)) return 1;
    if (name === "jsconfig.json") return 2;
    return 3;
  };
  return priority(left) - priority(right) || left.localeCompare(right);
}

function isJavaScriptLauncher(launcher: string): boolean {
  return [".js", ".cjs", ".mjs"].includes(path.extname(launcher));
}

function isWindowsCommandLauncher(launcher: string): boolean {
  return [".cmd", ".bat"].includes(path.extname(launcher).toLowerCase());
}

function quoteWindowsArg(arg: string): string {
  return `"${String(arg).replace(/"/g, '\\"').replace(/%/g, "%%")}"`;
}

/**
 * Locate the platform-specific `tsgo` binary installed alongside
 * `@typescript/native-preview` in the project rooted at `base`.
 */
export function resolveTsgoBinary(base: string): string | undefined {
  try {
    const requireFromBase = createRequire(
      path.join(base, "__ttsc_vscode_resolve__.cjs"),
    );
    const packageJson = requireFromBase.resolve(
      "@typescript/native-preview/package.json",
    );
    const packageRoot = path.dirname(packageJson);
    const requireFromTsgo = createRequire(
      path.join(packageRoot, "__ttsc_vscode_resolve__.cjs"),
    );
    const platformPackage = `@typescript/native-preview-${process.platform}-${process.arch}`;
    const platformPackageJson = requireFromTsgo.resolve(
      `${platformPackage}/package.json`,
    );
    const binary = path.join(
      path.dirname(platformPackageJson),
      "lib",
      process.platform === "win32" ? "tsgo.exe" : "tsgo",
    );
    return fs.existsSync(binary) ? binary : undefined;
  } catch {
    return undefined;
  }
}

/** Build the `child_process` spawn options for the language server process. */
export function serverProcessOptions(
  cwd?: string,
): ServerProcessOptions | undefined {
  if (!cwd) {
    return undefined;
  }
  const tsgo = resolveTsgoBinary(cwd);
  return {
    cwd,
    env: tsgo
      ? {
          ...process.env,
          TTSC_TSGO_BINARY: tsgo,
        }
      : process.env,
  };
}
