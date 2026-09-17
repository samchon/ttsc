import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findNearestGoMod } from "../../compiler/internal/paths";
import { readJsonFile } from "../../compiler/internal/project/readConfigJson";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import { spawnSyncResilient } from "../../internal/spawnSyncResilient";
import {
  javascriptRuntimeCapabilities,
  resolveNodeBinary,
} from "../../internal/resolveNodeBinary";
import type { ITtscPlugin } from "../../structures/ITtscPlugin";
import type { ITtscPluginContributor } from "../../structures/ITtscPluginContributor";
import type { ITtscPluginFactoryContext } from "../../structures/ITtscPluginFactoryContext";
import type { ITtscProjectPluginConfig } from "../../structures/ITtscProjectPluginConfig";
import type { TtscPluginStage } from "../../structures/TtscPluginStage";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import { buildSourcePlugin } from "./buildSourcePlugin";
import {
  pluginDescriptorFailureReason,
  pluginDescriptorProcessFailure,
} from "./descriptorProcessFailure";

const GO_MOD_SEARCH_MAX_DEPTH = 3;

type ProjectPluginEntry = {
  baseDir: string;
  config: ITtscProjectPluginConfig;
};

type PackageManifest = {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  exports?: unknown;
  main?: unknown;
  module?: unknown;
  name?: unknown;
  ttsc?: unknown;
};

type ProjectHostInputSnapshot = {
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
  project: ITtscParsedProjectConfig;
};

/**
 * Resolve, load, and build all native plugin sidecars for a TypeScript project.
 *
 * Reads the project config, discovers plugin entries (from tsconfig and package
 * auto-discovery), validates and composes their descriptors, then invokes
 * `buildSourcePlugin` to compile each Go source package into a cached binary.
 * Returns the ordered native plugins, parsed project config, and exact
 * JavaScript-host files that universally influence the loaded selection.
 *
 * @param options.binary - Absolute path to the ttsc native helper binary.
 * @param options.cacheDir - Override the plugin binary cache directory.
 * @param options.cwd - Working directory for resolving relative paths.
 * @param options.entries - Explicit plugin entries; `false` disables all
 *   plugins (skips both tsconfig entries and package auto-discovery).
 * @param options.env - Effective environment for source-plugin builds and
 *   isolated descriptor evaluators, including the `ttsx` fallback (`{
 *   ...process.env, ...context.env }`). Defaults to `process.env` for CLI
 *   callers, so ambient behavior is unchanged.
 * @param options.file - Path to the tsconfig/jsconfig file.
 * @param options.pluginConfigDir - Caller-declared anchor for plugin
 *   config-file discovery (see `ITtscPluginFactoryContext.pluginConfigDir`).
 * @param options.projectRoot - Override the project root directory.
 * @param options.tsconfig - Alias for `file`.
 */
export function loadProjectPlugins(options: {
  binary: string;
  cacheDir?: string;
  cwd?: string;
  entries?: readonly ITtscProjectPluginConfig[] | false;
  env?: NodeJS.ProcessEnv;
  file?: string;
  onWatchInputs?: (inputs: readonly string[]) => void;
  pluginConfigDir?: string;
  projectRoot?: string;
  tsconfig?: string;
}): {
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
  nativePlugins: ITtscLoadedNativePlugin[];
  project: ITtscParsedProjectConfig;
} {
  // Snapshot the caller environment before `withPluginLoaderEnv` injects
  // host-owned Node/ttsx locators into process.env. Under a Bun parent the
  // direct descriptor evaluator must remain Bun unless the caller explicitly
  // selected another runtime.
  const effectiveEnv = { ...(options.env ?? process.env) };
  const projectSnapshot = readProjectHostInputSnapshot({
    cwd: options.cwd,
    file: options.file,
    includePluginDiscovery: options.entries === undefined,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  const { project } = projectSnapshot;
  const projectHostInputs = projectSnapshot.hostInputs;
  const projectHostInputHashes = projectSnapshot.hostInputHashes;
  const projectHostInputRealpaths = projectSnapshot.hostInputRealpaths;
  const entries: ProjectPluginEntry[] =
    options.entries === false
      ? []
      : resolvePluginEntries(project, options.entries).filter(
          (entry) => entry.config.enabled !== false,
        );
  if (entries.length === 0) {
    options.onWatchInputs?.([]);
    return {
      ...collectHostInputSnapshot(
        project,
        {},
        [],
        projectHostInputs,
        revalidateHostInputHashes(projectHostInputHashes, projectHostInputs),
        revalidateHostInputRealpaths(
          projectHostInputRealpaths,
          projectHostInputs,
        ),
      ),
      nativePlugins: [],
      project,
    };
  }

  const cwd = path.resolve(options.cwd ?? process.cwd());
  const context = {
    binary: options.binary,
    cwd,
    ...(options.pluginConfigDir === undefined || options.pluginConfigDir === ""
      ? {}
      : { pluginConfigDir: path.resolve(cwd, options.pluginConfigDir) }),
    projectRoot: project.root,
    tsconfig: project.path,
  };
  const loadedEntries = withPluginLoaderEnv(() =>
    entries.map((entry) => {
      const specifier = entry.config.transform;
      if (typeof specifier !== "string" || specifier.length === 0) {
        throw new Error(
          `ttsc: plugin entry is missing a string "transform" field`,
        );
      }
      const entryCandidates = collectModuleResolutionCandidates(
        specifier,
        path.join(entry.baseDir, "package.json"),
        undefined,
      );
      // Capture every candidate before resolution chooses the descriptor entry.
      // A post-resolution snapshot could bless a higher-priority file created
      // after the resolver had already selected the old entry.
      const entryCandidateHashes = hashHostInputPaths(entryCandidates);
      const entryCandidateRealpaths = realpathHostInputPaths(entryCandidates);
      const request = resolvePluginRequest(specifier, entry.baseDir);
      const loaded = loadPluginEntry(
        entry.config,
        { ...context, plugin: entry.config },
        request,
        effectiveEnv,
      );
      const loadedHostInputHashes = mergeObservedHostInputHashes(
        loaded.hostInputHashes,
        hashHostInputPaths(Object.keys(loaded.hostInputHashes)),
      );
      const loadedHostInputRealpaths = mergeObservedHostInputRealpaths(
        loaded.hostInputRealpaths,
        realpathHostInputPaths(Object.keys(loaded.hostInputRealpaths)),
      );
      const hostInputHashes = mergeObservedHostInputHashes(
        entryCandidateHashes,
        loadedHostInputHashes,
      );
      const hostInputRealpaths = mergeObservedHostInputRealpaths(
        entryCandidateRealpaths,
        loadedHostInputRealpaths,
      );
      for (const input of loaded.hostInputs) {
        const absolute = path.resolve(input);
        if (
          !Object.prototype.hasOwnProperty.call(loadedHostInputHashes, absolute)
        ) {
          delete hostInputHashes[absolute];
        }
      }
      return {
        ...loaded,
        hostInputHashes,
        hostInputRealpaths,
        hostInputs: [...loaded.hostInputs, ...entryCandidates],
        request,
      };
    }),
  );
  const plugins = composePluginSources(
    entries,
    loadedEntries.map((entry) => entry.plugin),
  );

  const ttscVersion = readTtscVersion();
  const tsgoVersion = readTsgoVersion(context.projectRoot);
  const records = plugins.map((plugin, index) => {
    const stage = resolvePluginStage(plugin);
    validatePluginSource(plugin);
    const contributors = validatePluginContributors(plugin);
    const source = resolvePluginSource(plugin.source, context.projectRoot);
    const kind = resolveNativeSourceKind(
      source,
      plugin,
      entries[index]!.config,
      index,
    );
    if (kind === "linked" && stage !== "transform") {
      throw new Error(
        `ttsc: plugin "${pluginLabel(plugin, entries[index]!.config, index)}" source is a linked Go package, but only transform-stage plugins can be linked into a compiler host`,
      );
    }
    const linkedContributorName =
      kind === "linked"
        ? `linked_${String(index).padStart(6, "0")}`
        : undefined;
    const hostInputs = validatePluginHostInputs(plugin, index);
    const pluginHostInputHashes = validatePluginHostInputHashes(
      plugin,
      index,
      hostInputs,
    );
    const pluginHostInputRealpaths = validatePluginHostInputRealpaths(
      plugin,
      index,
      hostInputs,
    );
    return {
      capabilities: plugin.capabilities,
      contributors,
      config: entries[index]!.config,
      kind,
      label: pluginLabel(plugin, entries[index]!.config, index),
      linkedContributorName,
      name: plugin.name,
      reportsTypeScriptDiagnostics:
        plugin.reportsTypeScriptDiagnostics === true,
      request: loadedEntries[index]!.request,
      hostInputHashes: mergePluginHostInputHashes(
        loadedEntries[index]!.hostInputHashes,
        pluginHostInputHashes,
        loadedEntries[index]!.hostInputs,
        hostInputs,
      ),
      hostInputRealpaths: mergePluginHostInputHashes(
        loadedEntries[index]!.hostInputRealpaths,
        pluginHostInputRealpaths,
        loadedEntries[index]!.hostInputs,
        hostInputs,
      ),
      hostInputs: [...loadedEntries[index]!.hostInputs, ...hostInputs],
      source,
      stage,
    };
  });
  options.onWatchInputs?.(
    records.flatMap((record) => [
      record.source,
      ...(record.contributors?.map((contributor) => contributor.source) ?? []),
    ]),
  );
  const linkedContributors = records
    .filter((record) => record.stage === "transform")
    .flatMap((record) =>
      record.kind === "linked"
        ? [{ name: record.linkedContributorName!, source: record.source }]
        : [],
    );
  const transformHosts = records.filter(
    (record) => record.stage === "transform" && record.kind === "executable",
  );
  const hostContributors =
    linkedContributors.length === 0 ? undefined : linkedContributors;
  const builtTransformHosts = new Map<object, string>();
  for (const record of transformHosts) {
    builtTransformHosts.set(
      record,
      buildSourcePlugin({
        baseDir: context.projectRoot,
        cacheDir: options.cacheDir,
        contributors: mergeContributors(record.contributors, hostContributors),
        env: effectiveEnv,
        pluginName: record.label,
        source: record.source,
        ttscVersion,
        tsgoVersion,
      }),
    );
  }
  const fallbackDriverHost =
    transformHosts.length === 0 && linkedContributors.length !== 0
      ? buildSourcePlugin({
          baseDir: context.projectRoot,
          cacheDir: options.cacheDir,
          contributors: linkedContributors,
          env: effectiveEnv,
          label: "linked plugin host",
          pluginName: "linked-plugin-host",
          source: path.join(ttscPackageRoot(), "cmd", "utility-host"),
          ttscVersion,
          tsgoVersion,
        })
      : undefined;
  const selectedTransformHost =
    transformHosts.length === 0
      ? fallbackDriverHost
      : builtTransformHosts.get(transformHosts[0]!);
  const nativePlugins: ITtscLoadedNativePlugin[] = records.map((record) => {
    const binary =
      record.stage === "transform" && record.kind === "linked"
        ? selectedTransformHost
        : record.stage === "transform"
          ? builtTransformHosts.get(record)
          : buildSourcePlugin({
              baseDir: context.projectRoot,
              cacheDir: options.cacheDir,
              contributors: record.contributors,
              env: effectiveEnv,
              pluginName: record.label,
              source: record.source,
              ttscVersion,
              tsgoVersion,
            });
    if (binary === undefined) {
      throw new Error(
        `ttsc: plugin "${record.label}" is a linked Go package, but no compiler host is available`,
      );
    }
    return {
      binary,
      capabilities: record.capabilities,
      config: record.config,
      contributors: record.contributors,
      kind: record.kind,
      name: record.name,
      reportsTypeScriptDiagnostics: record.reportsTypeScriptDiagnostics,
      source: record.source,
      stage: record.stage,
    };
  });
  return {
    ...collectHostInputSnapshot(
      project,
      context,
      records,
      projectHostInputs,
      revalidateHostInputHashes(projectHostInputHashes, projectHostInputs),
      revalidateHostInputRealpaths(
        projectHostInputRealpaths,
        projectHostInputs,
      ),
    ),
    nativePlugins: orderNativePlugins(nativePlugins),
    project,
  };
}

/**
 * Collect exact JavaScript-host files that universally influence the loaded
 * transform. Program files belong to the native reference graph; this list is
 * deliberately limited to config ancestry, descriptor entries, the project
 * manifest controlling auto-discovery, and explicit plugin config files.
 */
function collectHostInputSnapshot(
  project: ITtscParsedProjectConfig,
  context: { pluginConfigDir?: string },
  records: readonly {
    config: ITtscProjectPluginConfig;
    hostInputHashes: Readonly<Record<string, string | null>>;
    hostInputRealpaths: Readonly<Record<string, string | null>>;
    hostInputs: readonly string[];
    request: string;
  }[],
  baselineInputs: readonly string[],
  baselineHashes: Readonly<Record<string, string | null>>,
  baselineRealpaths: Readonly<Record<string, string | null>>,
): {
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
} {
  const inputs = new Set<string>(
    baselineInputs.map((file) => path.resolve(file)),
  );
  const configBase = context.pluginConfigDir ?? path.dirname(project.path);
  for (const record of records) {
    inputs.add(path.resolve(record.request));
    for (const hostInput of record.hostInputs) {
      inputs.add(path.resolve(hostInput));
    }
    const descriptorManifest = findNearestPackageJson(record.request);
    if (descriptorManifest !== undefined) {
      inputs.add(path.resolve(descriptorManifest));
    }
    const configFile = record.config.configFile;
    if (typeof configFile === "string" && configFile.trim() !== "") {
      inputs.add(
        path.isAbsolute(configFile)
          ? path.resolve(configFile)
          : path.resolve(configBase, configFile),
      );
    }
  }
  const hostInputs = [...inputs].sort();
  const evaluationHashes = mergeObservedHostInputHashes(
    baselineHashes,
    ...records.map((record) => record.hostInputHashes),
  );
  const evaluationRealpaths = mergeObservedHostInputRealpaths(
    baselineRealpaths,
    ...records.map((record) => record.hostInputRealpaths),
  );
  for (const record of records) {
    for (const input of record.hostInputs) {
      const absolute = path.resolve(input);
      if (
        !Object.prototype.hasOwnProperty.call(record.hostInputHashes, absolute)
      ) {
        delete evaluationHashes[absolute];
      }
      if (
        !Object.prototype.hasOwnProperty.call(
          record.hostInputRealpaths,
          absolute,
        )
      ) {
        delete evaluationRealpaths[absolute];
      }
    }
  }
  const hostInputHashes = Object.fromEntries(
    hostInputs.flatMap((file) =>
      Object.prototype.hasOwnProperty.call(evaluationHashes, file)
        ? ([[file, evaluationHashes[file]!]] as const)
        : [],
    ),
  );
  const hostInputRealpaths = Object.fromEntries(
    hostInputs.flatMap((file) =>
      Object.prototype.hasOwnProperty.call(evaluationRealpaths, file)
        ? ([[file, evaluationRealpaths[file]!]] as const)
        : [],
    ),
  );
  return { hostInputHashes, hostInputRealpaths, hostInputs };
}

/**
 * Read one project configuration while its complete discovery surface remains
 * unchanged. The preliminary read discovers the input set; the accepted read is
 * bracketed by equal fingerprints for that same set. A repeatedly changing
 * project is still returned so compilation can make progress, but without any
 * cache proof for the ambiguous snapshot.
 */
function readProjectHostInputSnapshot(options: {
  cwd?: string;
  file?: string;
  includePluginDiscovery: boolean;
  projectRoot?: string;
  tsconfig?: string;
}): ProjectHostInputSnapshot {
  const { includePluginDiscovery, ...projectOptions } = options;
  let project = readProjectConfig(projectOptions);
  let hostInputs = collectProjectHostInputs(project, includePluginDiscovery);
  const observedInputs = new Set(hostInputs);
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = hashHostInputPaths(hostInputs);
    const beforeRealpaths = realpathHostInputPaths(hostInputs);
    const beforeSignatures = hostInputMetadataSignatures(hostInputs);
    const candidateProject = readProjectConfig(projectOptions);
    const candidateInputs = collectProjectHostInputs(
      candidateProject,
      includePluginDiscovery,
    );
    for (const input of candidateInputs) observedInputs.add(input);
    const after = hashHostInputPaths(candidateInputs);
    const afterRealpaths = realpathHostInputPaths(candidateInputs);
    const afterSignatures = hostInputMetadataSignatures(candidateInputs);
    if (
      equalHostInputLists(hostInputs, candidateInputs) &&
      equalHostInputHashes(before, after) &&
      equalHostInputHashes(beforeRealpaths, afterRealpaths) &&
      beforeSignatures !== undefined &&
      afterSignatures !== undefined &&
      equalHostInputHashes(beforeSignatures, afterSignatures)
    ) {
      return {
        hostInputHashes: after,
        hostInputRealpaths: afterRealpaths,
        hostInputs: candidateInputs,
        project: candidateProject,
      };
    }
    project = candidateProject;
    hostInputs = candidateInputs;
  }
  return {
    hostInputHashes: {},
    hostInputRealpaths: {},
    hostInputs: [...observedInputs].sort(),
    project,
  };
}

function equalHostInputLists(
  first: readonly string[],
  second: readonly string[],
): boolean {
  return (
    first.length === second.length &&
    first.every(
      (file, index) => path.resolve(file) === path.resolve(second[index]!),
    )
  );
}

function equalHostInputHashes(
  first: Readonly<Record<string, string | null>>,
  second: Readonly<Record<string, string | null>>,
): boolean {
  const files = Object.keys(first);
  return (
    files.length === Object.keys(second).length &&
    files.every(
      (file) =>
        Object.prototype.hasOwnProperty.call(second, file) &&
        first[file] === second[file],
    )
  );
}

/** Retain proof only for inputs whose initial and final observations agree. */
function revalidateHostInputHashes(
  initial: Readonly<Record<string, string | null>>,
  inputs: readonly string[],
): Record<string, string | null> {
  const current = hashHostInputPaths(inputs);
  const output: Record<string, string | null> = {};
  for (const input of inputs) {
    const absolute = path.resolve(input);
    if (
      Object.prototype.hasOwnProperty.call(initial, absolute) &&
      initial[absolute] === current[absolute]
    ) {
      output[absolute] = current[absolute]!;
    }
  }
  return output;
}

/** Keep physical-identity proof only while the same path resolves identically. */
function revalidateHostInputRealpaths(
  initial: Readonly<Record<string, string | null>>,
  inputs: readonly string[],
): Record<string, string | null> {
  const current = realpathHostInputPaths(inputs);
  return Object.fromEntries(
    inputs.flatMap((input) => {
      const absolute = path.resolve(input);
      return Object.prototype.hasOwnProperty.call(initial, absolute) &&
        initial[absolute] === current[absolute]
        ? ([[absolute, current[absolute]!]] as const)
        : [];
    }),
  );
}

function hashHostInput(file: string): string | null {
  try {
    if (fs.statSync(file).isDirectory()) {
      return crypto
        .createHash("sha256")
        .update("ttsc:host-input:directory\0")
        .digest("hex");
    }
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
  } catch {
    return null;
  }
}

export function hashHostInputPaths(
  files: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(
    files.map((file) => [path.resolve(file), hashHostInput(file)]),
  );
}

/** Physical path selected by a host input, or null while it is unresolved. */
export function realpathHostInput(file: string): string | null {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return null;
  }
}

export function realpathHostInputPaths(
  files: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(
    files.map((file) => [path.resolve(file), realpathHostInput(file)]),
  );
}

/**
 * Metadata identity that survives content-preserving reads but exposes A-B-A
 * replacement. Missing paths are tied to the nearest existing ancestor whose
 * directory metadata changes when the missing branch appears or disappears.
 */
function hostInputMetadataSignature(file: string): string | undefined {
  const requested = path.resolve(file);
  let current = requested;
  for (;;) {
    try {
      const link = fs.lstatSync(current, { bigint: true });
      let target = link;
      if (link.isSymbolicLink()) {
        try {
          target = fs.statSync(current, { bigint: true });
        } catch {
          // A broken link's own metadata cannot expose its target appearing
          // and disappearing during evaluation. Decline cache proof instead.
          return undefined;
        }
      }
      return [
        path.relative(current, requested),
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
      ].join(":");
    } catch (error) {
      if (!isMissingPathError(error)) return undefined;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

function hostInputMetadataSignatures(
  files: readonly string[],
): Record<string, string> | undefined {
  const output: Record<string, string> = {};
  for (const file of files) {
    const signature = hostInputMetadataSignature(file);
    if (signature === undefined) return undefined;
    output[path.resolve(file)] = signature;
  }
  return output;
}

function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/** Return config ancestry and the manifest controlling package discovery. */
export function collectProjectHostInputs(
  project: ITtscParsedProjectConfig,
  includePluginDiscovery: boolean = true,
): string[] {
  const inputs = new Set<string>(
    project.configPaths.map((file) => path.resolve(file)),
  );
  if (!includePluginDiscovery) return [...inputs].sort();
  const manifestCandidates = collectNearestPackageJsonCandidates(project.root);
  for (const candidate of manifestCandidates) inputs.add(candidate);
  const manifest = manifestCandidates.find(existingFile);
  if (manifest !== undefined) {
    const projectManifest = readPackageManifest(manifest);
    if (projectManifest !== undefined) {
      const projectRoot = path.dirname(manifest);
      for (const dependency of directDependencyNames(projectManifest)) {
        const dependencyManifest = resolveDependencyPackageJson(
          dependency,
          projectRoot,
        );
        for (const candidate of collectDependencyManifestCandidates(
          dependency,
          manifest,
          dependencyManifest,
        )) {
          inputs.add(candidate);
        }
        if (dependencyManifest !== undefined) {
          inputs.add(path.resolve(dependencyManifest));
        }
      }
    }
  }
  return [...inputs].sort();
}

// The direct evaluator preloads ttsx's supported Node hook, whose
// extensionless rescue order includes TypeScript and ESM/CJS spellings in
// addition to Node's ordinary CommonJS probes.
const MODULE_PROBE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".node",
] as const;

/** Record every file whose later appearance can change one module resolution. */
function collectModuleResolutionCandidates(
  specifier: string,
  parentFile: string,
  resolvedFile: string | undefined,
): string[] {
  const inputs = new Set<string>();
  const recordedBases = new Set<string>();
  const candidates = (base: string): string[] => [
    base,
    ...MODULE_PROBE_EXTENSIONS.map((extension) => base + extension),
    path.join(base, "package.json"),
    ...MODULE_PROBE_EXTENSIONS.map((extension) =>
      path.join(base, `index${extension}`),
    ),
  ];
  const recordManifestTargets = (
    value: unknown,
    directory: string,
    allowBare: boolean = false,
  ): void => {
    if (typeof value === "string") {
      if (
        value !== "" &&
        (allowBare || value.startsWith("./") || value.startsWith("../"))
      ) {
        recordBase(path.resolve(directory, value));
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        recordManifestTargets(item, directory, allowBare);
      }
      return;
    }
    if (isRecord(value)) {
      for (const item of Object.values(value)) {
        recordManifestTargets(item, directory, allowBare);
      }
    }
  };
  const recordBase = (base: string): void => {
    const resolvedBase = path.resolve(base);
    if (recordedBases.has(resolvedBase)) return;
    recordedBases.add(resolvedBase);
    for (const candidate of candidates(resolvedBase)) {
      inputs.add(path.resolve(candidate));
    }
    try {
      const manifest = readJsonFile(path.join(resolvedBase, "package.json"));
      if (isRecord(manifest)) {
        recordManifestTargets(manifest.exports, resolvedBase);
        recordManifestTargets(manifest.module, resolvedBase, true);
        recordManifestTargets(manifest.main, resolvedBase, true);
      }
    } catch {
      // A malformed selected manifest is reported by normal resolution/load.
    }
  };
  const selectedBy = (base: string): boolean => {
    if (resolvedFile === undefined) return false;
    let selected: string;
    try {
      selected = fs.realpathSync.native(resolvedFile);
    } catch {
      selected = path.resolve(resolvedFile);
    }
    for (const candidate of candidates(base)) {
      try {
        const canonical = fs.realpathSync.native(candidate);
        const relative = path.relative(canonical, selected);
        if (
          relative === "" ||
          (fs.statSync(canonical).isDirectory() &&
            relative !== ".." &&
            !relative.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relative))
        ) {
          return true;
        }
      } catch {
        // Missing candidates are the inputs this function intentionally keeps.
      }
    }
    return false;
  };
  const localBases = (): string[] => {
    if (specifier.startsWith("file:")) return [fileURLToPath(specifier)];
    const directory = path.dirname(parentFile);
    const raw = path.resolve(directory, specifier);
    const suffixStart = specifier.search(/[?#]/);
    if (suffixStart === -1) return [raw];
    const pathname = specifier.slice(0, suffixStart);
    return pathname === ""
      ? [raw]
      : [...new Set([raw, path.resolve(directory, pathname)])];
  };

  if (
    specifier.startsWith(".") ||
    path.isAbsolute(specifier) ||
    specifier.startsWith("file:")
  ) {
    try {
      for (const base of localBases()) {
        // An existing exact file wins before extension and directory probes.
        // Its own recorded identity is therefore sufficient; siblings cannot
        // supersede it while it exists.
        if (
          selectedByExactFile(base, resolvedFile) ||
          (resolvedFile === undefined && existingFile(base))
        ) {
          inputs.add(path.resolve(base));
        } else {
          recordBase(base);
        }
      }
    } catch {
      // Invalid URL spellings are diagnosed by the real resolver.
    }
    return [...inputs];
  }
  const parts = specifier.split("/");
  const packageParts = parts[0]?.startsWith("@")
    ? parts.slice(0, 2)
    : parts.slice(0, 1);
  if (packageParts.some((part) => part === undefined || part === "")) {
    return [...inputs];
  }
  const packageName = packageParts.join("/");
  const subpath = parts.slice(packageParts.length);
  const searchPaths = createRequire(parentFile).resolve.paths(specifier) ?? [];
  for (const searchPath of searchPaths) {
    const packageDirectory = path.join(searchPath, packageName);
    recordBase(packageDirectory);
    if (subpath.length !== 0) {
      recordBase(path.join(packageDirectory, ...subpath));
    }
    if (selectedBy(packageDirectory)) break;
  }
  return [...inputs];
}

function existingFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function selectedByExactFile(
  candidate: string,
  selected: string | undefined,
): boolean {
  if (selected === undefined) return false;
  try {
    return (
      fs.realpathSync.native(candidate) === fs.realpathSync.native(selected)
    );
  } catch {
    return path.resolve(candidate) === path.resolve(selected);
  }
}

/** Record package manifests whose later appearance can redirect discovery. */
function collectDependencyManifestCandidates(
  packageName: string,
  parentFile: string,
  selectedManifest: string | undefined,
): string[] {
  const out: string[] = [];
  let selectedDirectory: string | undefined;
  if (selectedManifest !== undefined) {
    try {
      selectedDirectory = fs.realpathSync.native(
        path.dirname(selectedManifest),
      );
    } catch {
      selectedDirectory = path.resolve(path.dirname(selectedManifest));
    }
  }
  for (const searchPath of createRequire(parentFile).resolve.paths(
    packageName,
  ) ?? []) {
    const packageDirectory = path.join(searchPath, ...packageName.split("/"));
    out.push(path.join(packageDirectory, "package.json"));
    if (selectedDirectory === undefined) continue;
    try {
      if (fs.realpathSync.native(packageDirectory) === selectedDirectory) break;
    } catch {
      // Keep searching until the selected package directory is reached.
    }
  }
  return out;
}

function composePluginSources(
  entries: readonly ProjectPluginEntry[],
  plugins: readonly ITtscPlugin[],
): ITtscPlugin[] {
  const aggregates = plugins
    .map((plugin, index) => ({ index, plugin }))
    .filter(({ plugin }) => Array.isArray(plugin.composes));
  if (aggregates.length === 0) {
    return [...plugins];
  }
  for (const { plugin } of aggregates) {
    for (const target of plugin.composes!) {
      if (typeof target !== "string" || target.trim() === "") {
        throw new Error(
          `ttsc: plugin "${plugin.name}" has an invalid "composes" target; ` +
            `targets must be non-empty plugin names or transform specifiers`,
        );
      }
    }
  }
  // Composition is intentionally one hop only: A.composes=[B] sends B to A's
  // binary, but if B.composes=[C] then C uses B's original source and does NOT
  // cascade to A. Detect cycles (A.composes=[B] && B.composes=[A]) and throw,
  // otherwise the silent reswap below would mis-route both plugins.
  for (const { index: i, plugin: a } of aggregates) {
    for (const { index: j, plugin: b } of aggregates) {
      if (i === j) continue;
      const aTransform = entries[i]?.config.transform;
      const bTransform = entries[j]?.config.transform;
      const aComposesB = a.composes!.some((alias) =>
        matchesPluginAlias(alias, b, bTransform),
      );
      const bComposesA = b.composes!.some((alias) =>
        matchesPluginAlias(alias, a, aTransform),
      );
      if (aComposesB && bComposesA) {
        throw new Error(
          `ttsc: plugin composes cycle detected between "${a.name}" and "${b.name}"; ` +
            `each plugin lists the other in its "composes" array — composition is one hop only, not transitive`,
        );
      }
    }
  }
  return plugins.map((plugin, index) => {
    const transform = entries[index]?.config.transform;
    const matchingAggregates = aggregates.filter(
      ({ index: aggregateIndex, plugin: aggregatePlugin }) =>
        aggregateIndex !== index &&
        aggregatePlugin.composes!.some((alias) =>
          matchesPluginAlias(alias, plugin, transform),
        ),
    );
    if (matchingAggregates.length > 1) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" is composed by multiple aggregate plugins; ` +
          `each plugin entry can be redirected to only one aggregate native host`,
      );
    }
    const aggregate = matchingAggregates[0];
    if (aggregate === undefined) {
      return plugin;
    }
    // A composed plugin's source is rerouted to the aggregate's binary,
    // so its own `contributors` would link into a different host than
    // it was authored against. The "one binary" guarantee in the
    // protocol doc holds only when the composed plugin defers entirely
    // to the aggregate; reject early instead of silently producing two
    // diverging binaries.
    if (plugin.contributors && plugin.contributors.length > 0) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" is composed by "${aggregate.plugin.name}" but declares its own "contributors"; ` +
          `move the contributors onto the aggregate plugin or drop the composes redirect`,
      );
    }
    return {
      ...plugin,
      source: aggregate.plugin.source,
      contributors: aggregate.plugin.contributors,
      // The composed plugin's runtime BINARY is the aggregate's binary,
      // so the CLI surface (which flags the sidecar parses) is the
      // aggregate's. Inherit `capabilities` from the aggregate so a
      // capability the aggregate declares — e.g. threadingArgs — does
      // not get silently dropped just because the composed entry's own
      // descriptor omitted it. If the aggregate did not set capabilities
      // we keep the composed plugin's own as a fallback.
      capabilities: aggregate.plugin.capabilities ?? plugin.capabilities,
    };
  });
}

function matchesPluginAlias(
  alias: string,
  plugin: ITtscPlugin,
  transform: ITtscProjectPluginConfig["transform"],
): boolean {
  return (
    alias === plugin.name ||
    (typeof transform === "string" && alias === transform)
  );
}

/**
 * Return `true` when the project has at least one enabled plugin entry.
 *
 * Used by callers that need to skip plugin-specific work when no plugins are
 * configured, without paying the full cost of `loadProjectPlugins`.
 *
 * @param entries - Explicit entries; `false` always returns `false`.
 */
export function hasProjectPluginEntries(
  project: ITtscParsedProjectConfig,
  entries?: readonly ITtscProjectPluginConfig[] | false,
): boolean {
  if (entries === false) {
    return false;
  }
  return resolvePluginEntries(project, entries).some(
    (entry) => entry.config.enabled !== false,
  );
}

function resolvePluginEntries(
  project: ITtscParsedProjectConfig,
  entries?: readonly ITtscProjectPluginConfig[],
): ProjectPluginEntry[] {
  if (entries !== undefined) {
    return entries.map((config) => ({
      baseDir: project.root,
      config,
    }));
  }
  const configured = project.compilerOptions.plugins.map((config, index) => {
    // A bare/package plugin specifier (e.g. "typia/lib/transform") must resolve
    // from the project's own node_modules, not from the tsconfig that declared
    // it: an `extends`ed base config (a shared `tests/config/tsconfig.json`)
    // declares the plugin, but the package is installed under the consuming
    // project. Only a relative specifier ("./plugin") is meaningful relative to
    // the declaring config's directory. Mirrors discoverPackagePluginEntries.
    const declaringDir = project.pluginBaseDirs[index];
    const baseDir =
      typeof config.transform === "string" &&
      isRelativePluginSpecifier(config.transform) &&
      declaringDir !== undefined
        ? declaringDir
        : project.root;
    return { baseDir, config };
  });
  return [...configured, ...discoverPackagePluginEntries(project, configured)];
}

function discoverPackagePluginEntries(
  project: ITtscParsedProjectConfig,
  configured: readonly ProjectPluginEntry[],
): ProjectPluginEntry[] {
  const projectPackageJson = findNearestPackageJson(project.root);
  if (projectPackageJson === undefined) {
    return [];
  }
  const projectPackageRoot = path.dirname(projectPackageJson);
  const projectManifest = readPackageManifest(projectPackageJson);
  if (projectManifest === undefined) {
    return [];
  }

  const configuredTransforms = createConfiguredTransformSet(configured);
  const out: ProjectPluginEntry[] = [];
  for (const name of directDependencyNames(projectManifest)) {
    const packageJson = resolveDependencyPackageJson(name, projectPackageRoot);
    if (packageJson === undefined) {
      continue;
    }
    const manifest = readPackageManifest(packageJson);
    const config = readPackagePluginConfig(name, manifest);
    if (config === undefined || config.enabled === false) {
      continue;
    }
    const packageRoot = path.dirname(packageJson);
    const transform = config.transform;
    if (typeof transform !== "string") {
      continue;
    }
    const baseDir = isRelativePluginSpecifier(transform)
      ? packageRoot
      : projectPackageRoot;
    const resolved = resolvePluginRequest(transform, baseDir);
    if (hasConfiguredTransform(configuredTransforms, transform, resolved)) {
      continue;
    }
    out.push({
      baseDir,
      config,
    });
    addConfiguredTransform(configuredTransforms, transform, resolved);
  }
  return out;
}

type ConfiguredTransformSet = {
  raw: Set<string>;
  resolved: Set<string>;
};

function createConfiguredTransformSet(
  entries: readonly ProjectPluginEntry[],
): ConfiguredTransformSet {
  const raw = new Set<string>();
  const resolved = new Set<string>();
  for (const entry of entries) {
    const transform = entry.config.transform;
    if (typeof transform !== "string" || transform.length === 0) {
      continue;
    }
    if (!isRelativePluginSpecifier(transform)) {
      raw.add(transform);
    }
    try {
      resolved.add(resolvePluginRequest(transform, entry.baseDir));
    } catch {
      // Keep the normal plugin loading error path for invalid explicit entries.
    }
  }
  return { raw, resolved };
}

function hasConfiguredTransform(
  configuredTransforms: ConfiguredTransformSet,
  transform: string,
  resolved: string,
): boolean {
  return (
    configuredTransforms.resolved.has(resolved) ||
    (!isRelativePluginSpecifier(transform) &&
      configuredTransforms.raw.has(transform))
  );
}

function addConfiguredTransform(
  configuredTransforms: ConfiguredTransformSet,
  transform: string,
  resolved: string,
): void {
  if (!isRelativePluginSpecifier(transform)) {
    configuredTransforms.raw.add(transform);
  }
  configuredTransforms.resolved.add(resolved);
}

function directDependencyNames(manifest: PackageManifest): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const dependencies of [
    manifest.dependencies,
    manifest.devDependencies,
  ]) {
    if (!isRecord(dependencies)) {
      continue;
    }
    for (const name of Object.keys(dependencies)) {
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

function resolveDependencyPackageJson(
  name: string,
  projectRoot: string,
): string | undefined {
  const direct = path.join(projectRoot, "node_modules", ...name.split("/"));
  const directManifest = path.join(direct, "package.json");
  if (existingFile(directManifest)) {
    return resolveRealPath(directManifest);
  }
  const projectPackage = path.join(projectRoot, "package.json");
  const projectRequire = createRequire(projectPackage);
  try {
    return resolveRealPath(projectRequire.resolve(`${name}/package.json`));
  } catch {
    try {
      return findNearestPackageJson(projectRequire.resolve(name));
    } catch {
      return undefined;
    }
  }
}

function findNearestPackageJson(location: string): string | undefined {
  const selected =
    collectNearestPackageJsonCandidates(location).find(existingFile);
  return selected === undefined ? undefined : resolveRealPath(selected);
}

/** Every package-scope candidate through the first regular manifest file. */
function collectNearestPackageJsonCandidates(location: string): string[] {
  let current = fs.statSync(location).isDirectory()
    ? location
    : path.dirname(location);
  const candidates: string[] = [];
  while (true) {
    const manifest = path.resolve(current, "package.json");
    candidates.push(manifest);
    if (existingFile(manifest)) return candidates;
    const parent = path.dirname(current);
    if (parent === current) return candidates;
    current = parent;
  }
}

/**
 * Read a package manifest, or `undefined` when the file is absent or is not a
 * JSON object. A malformed manifest throws naming the file: these are usually
 * files the user did not author, which makes an unattributed `JSON.parse`
 * message worse here than anywhere else.
 */
function readPackageManifest(file: string): PackageManifest | undefined {
  if (!existingFile(file)) {
    return undefined;
  }
  const parsed = readJsonFile(file);
  return isRecord(parsed) ? (parsed as PackageManifest) : undefined;
}

function readPackagePluginConfig(
  packageName: string,
  manifest: PackageManifest | undefined,
): ITtscProjectPluginConfig | undefined {
  const ttsc = manifest?.ttsc;
  if (!isRecord(ttsc) || !("plugin" in ttsc)) {
    return undefined;
  }
  const plugin = ttsc.plugin;
  if (!isRecord(plugin) || Array.isArray(plugin)) {
    throw new Error(
      `ttsc: package ${JSON.stringify(packageName)} declares invalid "ttsc.plugin"; expected an object`,
    );
  }
  if (typeof plugin.transform !== "string" || plugin.transform.length === 0) {
    throw new Error(
      `ttsc: package ${JSON.stringify(packageName)} declares invalid "ttsc.plugin.transform"; expected a non-empty string`,
    );
  }
  return { ...plugin } as ITtscProjectPluginConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function orderNativePlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin[] {
  return [
    ...plugins.filter((plugin) => plugin.stage === "check"),
    ...plugins.filter((plugin) => plugin.stage === "transform"),
  ];
}

function loadPluginEntry(
  entry: ITtscProjectPluginConfig,
  base: Omit<ITtscPluginFactoryContext, "dirname" | "filename">,
  request: string,
  effectiveEnv: NodeJS.ProcessEnv,
): {
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
  plugin: ITtscPlugin;
} {
  const specifier = entry.transform;
  if (typeof specifier !== "string" || specifier.length === 0) {
    throw new Error(`ttsc: plugin entry is missing a string "transform" field`);
  }

  // `dirname`/`filename` are per-entry: each plugin entry resolves to its own
  // descriptor module, so they are derived here from the resolved `request`
  // rather than carried on the shared base context. They give factories a
  // load-mode-independent stand-in for `__dirname`/`__filename`, which are
  // undefined when a descriptor loads through ttsx or as ESM.
  const context: ITtscPluginFactoryContext = {
    ...base,
    dirname: path.dirname(request),
    filename: request,
  };
  const loaded = loadPluginDescriptor(request, context, effectiveEnv);
  if (isTtscPlugin(loaded.descriptor)) {
    rejectJsTransformFunctions(specifier, loaded.descriptor);
    return {
      hostInputHashes: loaded.hostInputHashes,
      hostInputRealpaths: loaded.hostInputRealpaths,
      hostInputs: loaded.inputs,
      plugin: loaded.descriptor,
    };
  }
  throw new Error(
    `ttsc: plugin "${specifier}" does not export a valid ttsc plugin`,
  );
}

/**
 * Require a plugin descriptor entry, falling back to `ttsx` when Node cannot
 * load a `.ts` source entry directly.
 *
 * A descriptor entry that is `.ts` source — especially a package root that
 * re-exports a runtime alongside the descriptor — fails Node's loader on its
 * first extensionless import or un-stripped type, and its imports can fan out
 * into a whole transitive graph of source packages. Rather than reimplement
 * that graph build, run the entry through `ttsx`, which already builds each
 * `.ts` dependency on demand. The run is forced plugins-off across the whole
 * graph (`--no-plugins` for the entry, `TTSC_PLUGIN_DESCRIPTOR_LOAD` for every
 * dependency), so the descriptor's own — possibly self-hosting — transform
 * never runs and cannot deadlock. A package that loads directly (a compiled
 * descriptor, or Bun's native `.ts`) never reaches the fallback.
 */
function loadPluginDescriptor(
  request: string,
  context: ITtscPluginFactoryContext,
  effectiveEnv: NodeJS.ProcessEnv,
): IsolatedPluginDescriptor {
  try {
    return loadCommonJsDescriptor(request, context, effectiveEnv);
  } catch (error) {
    if (
      !TS_SOURCE_PATTERN.test(request) ||
      !(error instanceof CommonJsDescriptorLoadError) ||
      !error.retryWithTtsx
    ) {
      throw error;
    }
    const loaded = loadDescriptorViaTtsx(request, context, effectiveEnv);
    if (loaded === undefined) {
      throw error;
    }
    return loaded;
  }
}

interface IsolatedPluginDescriptor {
  descriptor: unknown;
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  inputs: string[];
}

class CommonJsDescriptorLoadError extends Error {
  public constructor(
    message: string,
    public readonly retryWithTtsx: boolean,
  ) {
    super(message);
    this.name = "CommonJsDescriptorLoadError";
  }
}

/**
 * Evaluate one CommonJS descriptor in a fresh runtime module-cache generation.
 *
 * Reloading an external descriptor dependency inside this process has no safe
 * cache operation: retaining it serves stale exports, while deleting it splits
 * any application singleton that required the same module first. Isolation
 * gives every descriptor load current bytes without mutating the host's cache.
 * The child invokes the factory before walking its graph, so lazy `require()`
 * calls are included, and a failed first load cannot strand poisoned children.
 */
function loadCommonJsDescriptor(
  request: string,
  context: ITtscPluginFactoryContext,
  effectiveEnv: NodeJS.ProcessEnv,
): IsolatedPluginDescriptor {
  const runtime = pluginDescriptorRuntimeBinary(effectiveEnv);
  const runtimeCapabilities = javascriptRuntimeCapabilities(
    runtime,
    effectiveEnv,
    context.projectRoot,
  );
  const node =
    !runtimeCapabilities.bun &&
    runtimeCapabilities.registerHooks &&
    runtimeCapabilities.executable !== undefined
      ? runtimeCapabilities.executable
      : resolveNodeBinary(effectiveEnv, context.projectRoot);
  const dir = createEvaluationTempDir();
  const out = path.join(dir, "descriptor.json");
  const inputsOut = path.join(dir, "descriptor-inputs.ndjson");
  const diagnostics = path.join(dir, "descriptor.stderr");
  const bunConfig = path.join(dir, "bunfig.toml");
  const runtimeHookPreload = path.join(
    __dirname,
    "..",
    "..",
    "launcher",
    "internal",
    "runtimeHookPreload.js",
  );
  try {
    if (runtimeCapabilities.bun) {
      // A descriptor receives exactly the environment supplied by its ttsc
      // invocation. Bun otherwise auto-loads project `.env*`, local/global
      // bunfig preloads and loaders, and may install a missing package from the
      // network. Those implicit authorities are neither part of Node's loader
      // contract nor reproducible host inputs, so isolate this evaluator from
      // them while retaining Bun's native TypeScript/module semantics.
      fs.writeFileSync(bunConfig, "", "utf8");
    }
    const diagnosticsFd = fs.openSync(diagnostics, "w");
    let result: ReturnType<typeof childProcess.spawnSync>;
    try {
      result = spawnSyncResilient(
        runtime,
        [
          ...(runtimeCapabilities.bun
            ? [
                "--no-env-file",
                "--no-install",
                `--config=${bunConfig}`,
                `--tsconfig-override=${context.tsconfig}`,
              ]
            : []),
          ...(runtimeCapabilities.registerHooks
            ? ["--require", runtimeHookPreload]
            : []),
          "-e",
          COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE,
        ],
        {
          cwd: context.projectRoot,
          env: {
            ...effectiveEnv,
            // The direct evaluator may be Bun, but ttsx and native config
            // loaders require a real Node runtime with synchronous hooks.
            ...(node === undefined ? {} : { TTSC_NODE_BINARY: node }),
            TTSC_TTSX_BINARY:
              effectiveEnv.TTSC_TTSX_BINARY ?? process.env.TTSC_TTSX_BINARY,
            TTSC_PLUGIN_CONTEXT: JSON.stringify(context),
            TTSC_PLUGIN_DESCRIPTOR_LOAD: "1",
            TTSC_PLUGIN_DESCRIPTOR_OUT: out,
            TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE: "1",
            TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT: inputsOut,
            TTSC_PLUGIN_ENTRY: request,
          },
          // Hold direct-evaluator diagnostics until its retry decision is
          // known. A successful ttsx fallback must not inherit the expected
          // loader stack from the discarded first attempt.
          stdio: ["ignore", diagnosticsFd, diagnosticsFd],
          windowsHide: true,
        },
        { stderr: diagnostics, stdout: diagnostics },
      );
    } finally {
      fs.closeSync(diagnosticsFd);
    }
    const failure = commonJsDescriptorProcessFailure(result, request);
    if (failure !== undefined) {
      const reason = pluginDescriptorFailureReason(out);
      const retryWithTtsx = commonJsDescriptorRetryWithTtsx(out);
      if (!retryWithTtsx) replayEvaluationDiagnostics(diagnostics);
      throw new CommonJsDescriptorLoadError(
        reason === "" ? failure.message : `${failure.message}\n${reason}`,
        retryWithTtsx,
      );
    }
    replayEvaluationDiagnostics(diagnostics);
    if (!fs.existsSync(out)) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" evaluation in an isolated process produced no descriptor output.`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(out, "utf8"));
    } catch (error) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" produced invalid isolated output: ${errorMessage(error)}`,
      );
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.inputs)) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" produced an invalid isolated result`,
      );
    }
    const parsedHashes = isRecord(parsed.inputHashes)
      ? Object.fromEntries(
          Object.entries(parsed.inputHashes).flatMap(([file, hash]) =>
            typeof hash === "string" || hash === null
              ? [[path.resolve(file), hash]]
              : [],
          ),
        )
      : {};
    const parsedRealpaths = isRecord(parsed.inputRealpaths)
      ? Object.fromEntries(
          Object.entries(parsed.inputRealpaths).flatMap(([file, realpath]) =>
            (typeof realpath === "string" && path.isAbsolute(realpath)) ||
            realpath === null
              ? [
                  [
                    path.resolve(file),
                    realpath === null ? null : path.resolve(realpath),
                  ],
                ]
              : [],
          ),
        )
      : {};
    const stableParsedRealpaths = mergeObservedHostInputRealpaths(
      parsedRealpaths,
      realpathHostInputPaths(Object.keys(parsedRealpaths)),
    );
    for (const input of parsed.inputs) {
      const absolute = path.resolve(String(input));
      if (
        !Object.prototype.hasOwnProperty.call(stableParsedRealpaths, absolute)
      ) {
        delete parsedHashes[absolute];
      }
    }
    const runtimeInputs = readTtsxDescriptorInputs(inputsOut, request);
    return {
      descriptor: parsed.descriptor,
      hostInputHashes: omitUnstableHostInputHashes(
        mergeObservedHostInputHashes(
          parsedHashes,
          runtimeInputs.hostInputHashes,
        ),
        runtimeInputs.unstableInputs,
      ),
      hostInputRealpaths: mergeObservedHostInputRealpaths(
        stableParsedRealpaths,
        runtimeInputs.hostInputRealpaths,
      ),
      inputs: [
        ...new Set([
          ...parsed.inputs.map((input) => String(input)),
          ...runtimeInputs.inputs,
        ]),
      ].sort(),
    };
  } finally {
    removeEvaluationTempDir(dir);
  }
}

/** Validate plugin-declared universal host inputs. */
function validatePluginHostInputs(
  plugin: ITtscPlugin,
  index: number,
): string[] {
  const label = plugin.name ?? `#${index + 1}`;
  if (plugin.hostInputs === undefined) return [];
  if (!Array.isArray(plugin.hostInputs)) {
    throw new Error(
      `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputs"; expected an array of absolute paths`,
    );
  }
  return plugin.hostInputs.map((file) => {
    if (typeof file !== "string" || !path.isAbsolute(file)) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputs" entry ${JSON.stringify(file)}; expected an absolute path`,
      );
    }
    return path.resolve(file);
  });
}

/** Validate descriptor-supplied evaluation fingerprints for host inputs. */
function validatePluginHostInputHashes(
  plugin: ITtscPlugin,
  index: number,
  hostInputs: readonly string[],
): Record<string, string | null> {
  const label = plugin.name ?? `#${index + 1}`;
  if (plugin.hostInputHashes === undefined) return {};
  if (
    !isRecord(plugin.hostInputHashes) ||
    Array.isArray(plugin.hostInputHashes)
  ) {
    throw new Error(
      `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputHashes"; expected an object keyed by absolute hostInputs paths`,
    );
  }
  const allowed = new Set(hostInputs.map((file) => path.resolve(file)));
  const output: Record<string, string | null> = {};
  for (const [file, hash] of Object.entries(plugin.hostInputHashes)) {
    if (!path.isAbsolute(file)) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputHashes" key ${JSON.stringify(file)}; expected an absolute path`,
      );
    }
    const absolute = path.resolve(file);
    if (!allowed.has(absolute)) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} fingerprints ${JSON.stringify(file)} without listing it in "hostInputs"`,
      );
    }
    if (
      hash !== null &&
      (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash))
    ) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} has invalid fingerprint for ${JSON.stringify(file)}; expected a lowercase SHA-256 digest or null`,
      );
    }
    output[absolute] = hash;
  }
  return output;
}

/** Validate descriptor-supplied physical identities for host inputs. */
function validatePluginHostInputRealpaths(
  plugin: ITtscPlugin,
  index: number,
  hostInputs: readonly string[],
): Record<string, string | null> {
  const label = plugin.name ?? `#${index + 1}`;
  if (plugin.hostInputRealpaths === undefined) return {};
  if (
    !isRecord(plugin.hostInputRealpaths) ||
    Array.isArray(plugin.hostInputRealpaths)
  ) {
    throw new Error(
      `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputRealpaths"; expected an object keyed by absolute hostInputs paths`,
    );
  }
  const allowed = new Set(hostInputs.map((file) => path.resolve(file)));
  const output: Record<string, string | null> = {};
  for (const [file, realpath] of Object.entries(plugin.hostInputRealpaths)) {
    if (!path.isAbsolute(file)) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputRealpaths" key ${JSON.stringify(file)}; expected an absolute path`,
      );
    }
    const absolute = path.resolve(file);
    if (!allowed.has(absolute)) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} identifies ${JSON.stringify(file)} without listing it in "hostInputs"`,
      );
    }
    if (
      realpath !== null &&
      (typeof realpath !== "string" || !path.isAbsolute(realpath))
    ) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} has invalid physical identity for ${JSON.stringify(file)}; expected an absolute realpath or null`,
      );
    }
    output[absolute] =
      realpath === null ? null : path.resolve(realpath as string);
  }
  return output;
}

/** Merge snapshots and omit every path observed in contradictory states. */
function mergeObservedHostInputHashes(
  ...sources: Readonly<Record<string, string | null>>[]
): Record<string, string | null> {
  const conflicts = new Set<string>();
  const output: Record<string, string | null> = {};
  for (const source of sources) {
    for (const [file, hash] of Object.entries(source)) {
      const absolute = path.resolve(file);
      if (conflicts.has(absolute)) continue;
      if (
        Object.prototype.hasOwnProperty.call(output, absolute) &&
        output[absolute] !== hash
      ) {
        delete output[absolute];
        conflicts.add(absolute);
        continue;
      }
      output[absolute] = hash;
    }
  }
  return output;
}

const mergeObservedHostInputRealpaths = mergeObservedHostInputHashes;

/** Prevent a later plugin claim from reviving an unstable loader input. */
function mergePluginHostInputHashes(
  first: Readonly<Record<string, string | null>>,
  second: Readonly<Record<string, string | null>>,
  loaderInputs: readonly string[],
  pluginInputs: readonly string[],
): Record<string, string | null> {
  const output = { ...first };
  const guarded = new Set(loaderInputs.map((file) => path.resolve(file)));
  for (const input of pluginInputs) {
    const absolute = path.resolve(input);
    if (!Object.prototype.hasOwnProperty.call(second, absolute)) {
      delete output[absolute];
    }
  }
  for (const [file, hash] of Object.entries(second)) {
    const absolute = path.resolve(file);
    if (
      guarded.has(absolute) &&
      !Object.prototype.hasOwnProperty.call(first, absolute)
    ) {
      continue;
    }
    if (
      Object.prototype.hasOwnProperty.call(output, absolute) &&
      output[absolute] !== hash
    ) {
      delete output[absolute];
      continue;
    }
    output[absolute] = hash;
  }
  return output;
}

function omitUnstableHostInputHashes(
  hashes: Record<string, string | null>,
  unstableInputs: readonly string[],
): Record<string, string | null> {
  for (const input of unstableInputs) delete hashes[path.resolve(input)];
  return hashes;
}

/** CommonJS evaluator emitted into a clean Node process for every load. */
export const COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE = [
  `const crypto = require("node:crypto");`,
  `const fs = require("node:fs");`,
  `const Module = require("node:module");`,
  `const path = require("node:path");`,
  `const { fileURLToPath } = require("node:url");`,
  `const out = process.env.TTSC_PLUGIN_DESCRIPTOR_OUT;`,
  `let retryWithTtsx = false;`,
  `const moduleLoadFailures = new WeakMap();`,
  `const moduleResolutionFailures = new WeakMap();`,
  `function existingFile(file) { try { return fs.statSync(file).isFile(); } catch { return false; } }`,
  `function shouldRetryWithTtsx(error) {`,
  `  const loadFailure = error && (typeof error === "object" || typeof error === "function") ? moduleLoadFailures.get(error) : undefined;`,
  `  if (loadFailure?.retryWithTtsx === true) return true;`,
  `  const failure = error && (typeof error === "object" || typeof error === "function") ? moduleResolutionFailures.get(error) : undefined;`,
  `  return failure?.retryWithTtsx === true;`,
  `}`,
  `try {`,
  `  const request = process.env.TTSC_PLUGIN_ENTRY;`,
  `  const context = JSON.parse(process.env.TTSC_PLUGIN_CONTEXT);`,
  `  const inputs = new Set();`,
  `  const inputHashes = new Map();`,
  `  const inputRealpaths = new Map();`,
  `  const inputSignatures = new Map();`,
  `  const unstableInputHashes = new Set();`,
  `  function missingPathError(error) { return error && (error.code === "ENOENT" || error.code === "ENOTDIR"); }`,
  `  function inputMetadataSignature(file) {`,
  `    const requested = path.resolve(file);`,
  `    let current = requested;`,
  `    for (;;) {`,
  `      try {`,
  `        const link = fs.lstatSync(current, { bigint: true });`,
  `        let target = link;`,
  `        if (link.isSymbolicLink()) {`,
  `          try { target = fs.statSync(current, { bigint: true }); }`,
  `          catch { return undefined; }`,
  `        }`,
  `        return [path.relative(current, requested), link.dev, link.ino, link.mode, link.size, link.mtimeNs, link.ctimeNs, target.dev, target.ino, target.mode, target.size, target.mtimeNs, target.ctimeNs].join(":");`,
  `      } catch (error) {`,
  `        if (!missingPathError(error)) return undefined;`,
  `        const parent = path.dirname(current);`,
  `        if (parent === current) return undefined;`,
  `        current = parent;`,
  `      }`,
  `    }`,
  `  }`,
  `  function recordOneInput(file) {`,
  `    file = path.resolve(file);`,
  `    inputs.add(file);`,
  `    if (unstableInputHashes.has(file)) return;`,
  `    const beforeSignature = inputMetadataSignature(file);`,
  `    let observedRealpath;`,
  `    try { observedRealpath = fs.realpathSync.native(file); } catch { observedRealpath = null; }`,
  `    let observed;`,
  `    try { observed = fs.statSync(file).isDirectory() ? crypto.createHash("sha256").update("ttsc:host-input:directory\\0").digest("hex") : crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); } catch { observed = null; }`,
  `    const afterSignature = inputMetadataSignature(file);`,
  `    if (beforeSignature === undefined || afterSignature === undefined || beforeSignature !== afterSignature || (inputSignatures.has(file) && inputSignatures.get(file) !== afterSignature) || (inputRealpaths.has(file) && inputRealpaths.get(file) !== observedRealpath) || (inputHashes.has(file) && inputHashes.get(file) !== observed)) { inputHashes.delete(file); inputRealpaths.delete(file); inputSignatures.delete(file); unstableInputHashes.add(file); return; }`,
  `    inputSignatures.set(file, afterSignature);`,
  `    inputRealpaths.set(file, observedRealpath);`,
  `    inputHashes.set(file, observed);`,
  `  }`,
  `  function recordInput(file) {`,
  `    file = path.resolve(file);`,
  `    recordOneInput(file);`,
  `    const parsed = path.parse(file);`,
  `    let current = parsed.root;`,
  `    const relative = path.relative(parsed.root, file);`,
  `    for (const segment of relative.split(path.sep).slice(0, -1)) {`,
  `      if (segment === "") continue;`,
  `      current = path.join(current, segment);`,
  `      try {`,
  `        if (fs.lstatSync(current).isSymbolicLink()) recordOneInput(current);`,
  `      } catch {`,
  `        break;`,
  `      }`,
  `    }`,
  `  }`,
  `  function asFile(resolved) {`,
  `    if (typeof resolved !== "string") return undefined;`,
  `    if (!resolved.startsWith("file:")) return path.isAbsolute(resolved) ? path.resolve(resolved) : undefined;`,
  `    try { return path.resolve(fileURLToPath(resolved)); } catch { return undefined; }`,
  `  }`,
  `  function recordFile(resolved) {`,
  `    const file = asFile(resolved);`,
  `    if (file === undefined) return;`,
  `    recordInput(file);`,
  `    for (let directory = path.dirname(file);;) {`,
  `      const manifest = path.join(directory, "package.json");`,
  `      recordInput(manifest);`,
  `      if (existingFile(manifest)) break;`,
  `      const parent = path.dirname(directory);`,
  `      if (parent === directory) break;`,
  `      directory = parent;`,
  `    }`,
  `  }`,
  `  function recordPackageManifests(file) {`,
  `    for (let directory = path.dirname(path.resolve(file));;) {`,
  `      const manifest = path.join(directory, "package.json");`,
  `      recordInput(manifest);`,
  `      if (existingFile(manifest)) return;`,
  `      const parent = path.dirname(directory);`,
  `      if (parent === directory) return;`,
  `      directory = parent;`,
  `    }`,
  `  }`,
  `  recordFile(request);`,
  `  const moduleProbeExtensions = typeof globalThis.Bun === "object" ? [".tsx", ".jsx", ".ts", ".mjs", ".js", ".cjs", ".json"] : [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json", ".node"];`,
  `  const jsToTsProbeExtensions = new Map([[".js", [".ts", ".tsx"]], [".jsx", [".tsx"]], [".mjs", [".mts"]], [".cjs", [".cts"]]]);`,
  `  function sourceSubstitutionCandidates(base) {`,
  `    const extension = path.extname(base).toLowerCase();`,
  `    const substitutions = jsToTsProbeExtensions.get(extension);`,
  `    if (substitutions === undefined) return [];`,
  `    const stem = base.slice(0, base.length - extension.length);`,
  `    return substitutions.map((candidate) => stem + candidate);`,
  `  }`,
  `  function moduleCandidates(base) {`,
  `    return [base, ...sourceSubstitutionCandidates(base), ...moduleProbeExtensions.map((extension) => base + extension), path.join(base, "package.json"), ...moduleProbeExtensions.map((extension) => path.join(base, "index" + extension))];`,
  `  }`,
  `  const recordedModuleBases = new Set();`,
  `  function recordManifestTargets(value, directory, allowBare = false) {`,
  `    if (typeof value === "string") {`,
  `      if (value !== "" && (allowBare || value.startsWith("./") || value.startsWith("../"))) recordModuleCandidates(path.resolve(directory, value));`,
  `      return;`,
  `    }`,
  `    if (Array.isArray(value)) { for (const item of value) recordManifestTargets(item, directory, allowBare); return; }`,
  `    if (value && typeof value === "object") for (const item of Object.values(value)) recordManifestTargets(item, directory, allowBare);`,
  `  }`,
  `  function recordModuleCandidates(base) {`,
  `    const resolvedBase = path.resolve(base);`,
  `    if (recordedModuleBases.has(resolvedBase)) return;`,
  `    recordedModuleBases.add(resolvedBase);`,
  `    for (const candidate of moduleCandidates(resolvedBase)) recordInput(candidate);`,
  `    try {`,
  `      const manifest = JSON.parse(fs.readFileSync(path.join(resolvedBase, "package.json"), "utf8").replace(/^\uFEFF/, ""));`,
  `      recordManifestTargets(manifest.exports, resolvedBase);`,
  `      recordManifestTargets(manifest.module, resolvedBase, true);`,
  `      recordManifestTargets(manifest.main, resolvedBase, true);`,
  `    } catch {}`,
  `  }`,
  `  function candidateSelected(base, selected) {`,
  `    if (selected === undefined) return false;`,
  `    for (const candidate of moduleCandidates(base)) {`,
  `      try {`,
  `        const canonical = fs.realpathSync.native(candidate);`,
  `        const relative = path.relative(canonical, selected);`,
  `        if (relative === "" || (fs.statSync(canonical).isDirectory() && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))) return true;`,
  `      } catch {}`,
  `    }`,
  `    return false;`,
  `  }`,
  `  function localBases(specifier, parentFile) {`,
  `    if (specifier.startsWith("file:")) return [fileURLToPath(specifier)];`,
  `    const directory = path.dirname(parentFile);`,
  `    const raw = path.resolve(directory, specifier);`,
  `    const suffixStart = specifier.search(/[?#]/);`,
  `    if (suffixStart === -1) return [raw];`,
  `    const pathname = specifier.slice(0, suffixStart);`,
  `    return pathname === "" ? [raw] : [...new Set([raw, path.resolve(directory, pathname)])];`,
  `  }`,
  `  function recordResolutionCandidates(specifier, parent, resolved) {`,
  `    const parentFile = asFile(parent);`,
  `    if (typeof specifier !== "string" || parentFile === undefined) return;`,
  `    let selected;`,
  `    try { const file = asFile(resolved); selected = file === undefined ? undefined : fs.realpathSync.native(file); } catch {}`,
  `    if (specifier.startsWith(".") || path.isAbsolute(specifier) || specifier.startsWith("file:")) {`,
  `      try {`,
  `        for (const base of localBases(specifier, parentFile)) {`,
  `          recordPackageManifests(base);`,
  `          let exact = false;`,
  `          try { exact = selected === undefined ? fs.statSync(base).isFile() : fs.realpathSync.native(base) === selected; } catch {}`,
  `          if (exact) recordInput(base);`,
  `          if (!exact) recordModuleCandidates(base);`,
  `        }`,
  `      } catch {}`,
  `      return;`,
  `    }`,
  `    if (Module.isBuiltin(specifier) || specifier.startsWith("#")) return;`,
  `    const parts = specifier.split("/");`,
  `    const packageParts = parts[0].startsWith("@") ? parts.slice(0, 2) : parts.slice(0, 1);`,
  `    if (packageParts.some((part) => part === undefined || part === "")) return;`,
  `    const packageName = packageParts.join("/");`,
  `    const subpath = parts.slice(packageParts.length);`,
  `    const searchPaths = Module.createRequire(parentFile).resolve.paths(specifier) ?? [];`,
  `    for (const searchPath of searchPaths) {`,
  `      const packageDirectory = path.join(searchPath, packageName);`,
  `      recordModuleCandidates(packageDirectory);`,
  `      if (subpath.length !== 0) recordModuleCandidates(path.join(packageDirectory, ...subpath));`,
  `      if (candidateSelected(packageDirectory, selected)) break;`,
  `    }`,
  `  }`,
  `  function scanBunModuleGraph(entry) {`,
  `    if (typeof globalThis.Bun !== "object" || typeof globalThis.Bun.Transpiler !== "function") return;`,
  `    const scanned = new Set();`,
  `    function scan(file) {`,
  `      file = asFile(file);`,
  `      if (file === undefined) return;`,
  `      let canonical;`,
  `      try { canonical = fs.realpathSync.native(file); } catch { return; }`,
  `      if (scanned.has(canonical)) return;`,
  `      scanned.add(canonical);`,
  `      const extension = path.extname(canonical).toLowerCase();`,
  `      if (![".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"].includes(extension)) return;`,
  `      const loader = extension === ".tsx" ? "tsx" : extension === ".jsx" ? "jsx" : [".ts", ".mts", ".cts"].includes(extension) ? "ts" : "js";`,
  `      let imports;`,
  `      try {`,
  `        const source = fs.readFileSync(canonical, "utf8");`,
  `        imports = new globalThis.Bun.Transpiler({ loader }).scan(source).imports;`,
  `      } catch { return; }`,
  `      for (const imported of imports) {`,
  `        const specifier = imported && imported.path;`,
  `        if (typeof specifier !== "string" || specifier.startsWith("node:") || Module.isBuiltin(specifier)) continue;`,
  `        recordResolutionCandidates(specifier, canonical, undefined);`,
  `        try {`,
  `          const resolved = globalThis.Bun.resolveSync(specifier, path.dirname(canonical));`,
  `          recordResolutionCandidates(specifier, canonical, resolved);`,
  `          recordFile(resolved);`,
  `          scan(resolved);`,
  `        } catch {`,
  `          // The real descriptor load below owns user-facing resolution errors.`,
  `        }`,
  `      }`,
  `    }`,
  `    scan(entry);`,
  `  }`,
  `  if (typeof Module.registerHooks === "function") {`,
  `    Module.registerHooks({`,
  `      load(url, loadContext, nextLoad) {`,
  `        try { return nextLoad(url, loadContext); }`,
  `        catch (error) {`,
  `          if (error && (typeof error === "object" || typeof error === "function")) moduleLoadFailures.set(error, { retryWithTtsx: error.code === "ERR_UNKNOWN_FILE_EXTENSION" });`,
  `          throw error;`,
  `        }`,
  `      },`,
  `      resolve(specifier, resolveContext, nextResolve) {`,
  `        recordResolutionCandidates(specifier, resolveContext.parentURL, undefined);`,
  `        let resolved;`,
  `        try {`,
  `          resolved = nextResolve(specifier, resolveContext);`,
  `        } catch (error) {`,
  `          if (error && (typeof error === "object" || typeof error === "function")) {`,
  `            const parent = asFile(resolveContext.parentURL);`,
  `            const anchor = typeof parent === "string" ? parent : request;`,
  `            const candidate = specifier.startsWith(".") && path.extname(specifier) === "" ? path.resolve(path.dirname(anchor), specifier) : undefined;`,
  `            const retryWithTtsx = candidate !== undefined && [".ts", ".cts", ".mts", ".tsx"].some((extension) => existingFile(candidate + extension) || existingFile(path.join(candidate, "index" + extension)));`,
  `            moduleResolutionFailures.set(error, { retryWithTtsx });`,
  `          }`,
  `          throw error;`,
  `        }`,
  `        const url = typeof resolved === "string" ? resolved : resolved && resolved.url;`,
  `        recordResolutionCandidates(specifier, resolveContext.parentURL, url);`,
  `        recordFile(url);`,
  `        return resolved;`,
  `      },`,
  `    });`,
  `  }`,
  `  if (typeof globalThis.Bun === "object" && typeof globalThis.Bun.plugin === "function") {`,
  `    let insideBunResolve = false;`,
  `    globalThis.Bun.plugin({`,
  `      name: "ttsc-plugin-descriptor-inputs",`,
  `      setup(build) {`,
  `        build.onResolve({ filter: /.*/ }, (args) => {`,
  `          if (insideBunResolve || args.path.startsWith("node:")) return;`,
  `          try {`,
  `            insideBunResolve = true;`,
  `            const importer = args.importer && args.importer.startsWith("file:") ? fileURLToPath(args.importer) : args.importer;`,
  `            const from = importer ? path.dirname(importer) : process.cwd();`,
  `            recordResolutionCandidates(args.path, importer, undefined);`,
  `            const resolved = globalThis.Bun.resolveSync(args.path, from);`,
  `            recordResolutionCandidates(args.path, importer, resolved);`,
  `            recordFile(resolved);`,
  `          } catch {`,
  `            // The real resolver below owns user-facing resolution errors.`,
  `          } finally {`,
  `            insideBunResolve = false;`,
  `          }`,
  `        });`,
  `      },`,
  `    });`,
  `  }`,
  `  scanBunModuleGraph(request);`,
  `  let mod;`,
  `  try {`,
  `    mod = require(request);`,
  `  } catch (error) {`,
  `    retryWithTtsx = shouldRetryWithTtsx(error);`,
  `    throw error;`,
  `  }`,
  `  const candidate = mod.createTtscPlugin ?? mod.default ?? mod.plugin ?? mod;`,
  `  const descriptor = typeof candidate === "function" ? candidate(context) : candidate;`,
  `  if (descriptor && typeof descriptor === "object" && ("transformSource" in descriptor || "transformOutput" in descriptor)) {`,
  `    throw new Error("ttsc: plugin descriptor declares unsupported JS transform functions; declare a native backend instead");`,
  `  }`,
  // Serialize the descriptor while the module-resolution hooks are still
  // collecting. Getters are allowed by JavaScript's object model and can
  // lazily require a config; snapshotting inputs first would silently omit
  // that influence.
  `  const serializedDescriptor = JSON.stringify(descriptor);`,
  `  for (const input of [...inputs]) recordInput(input);`,
  `  const payload = { inputHashes: Object.fromEntries(inputHashes), inputRealpaths: Object.fromEntries(inputRealpaths), inputs: [...inputs].sort() };`,
  `  if (serializedDescriptor !== undefined) payload.descriptor = JSON.parse(serializedDescriptor);`,
  `  fs.writeFileSync(out, JSON.stringify(payload));`,
  `} catch (error) {`,
  `  const message = error instanceof Error ? error.message : String(error);`,
  `  const stack = error instanceof Error && error.stack ? error.stack : String(error);`,
  `  try {`,
  `    fs.writeFileSync(out, JSON.stringify({ __ttscLoaderError: message, __ttscRetryWithTtsx: retryWithTtsx }));`,
  `  } catch {}`,
  `  try { process.stderr.write(stack + "\\n"); } catch {}`,
  `  process.exit(1);`,
  `}`,
  ``,
].join("\n");

/** Read the isolated loader's explicit retry classification. */
function commonJsDescriptorRetryWithTtsx(file: string): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return isRecord(parsed) && parsed.__ttscRetryWithTtsx === true;
  } catch {
    return false;
  }
}

function commonJsDescriptorProcessFailure(
  result: {
    error?: Error;
    signal: NodeJS.Signals | null;
    status: number | null;
  },
  request: string,
): Error | undefined {
  if (result.error !== undefined) {
    return new Error(
      `ttsc: failed to launch an isolated process for plugin descriptor "${request}": ${result.error.message}`,
    );
  }
  if (result.signal !== null) {
    return new Error(
      `ttsc: plugin descriptor "${request}" isolated evaluation was killed by signal ${result.signal}.`,
    );
  }
  if (result.status !== 0) {
    return new Error(
      `ttsc: plugin descriptor "${request}" isolated evaluation failed with exit code ${String(result.status)}`,
    );
  }
  return undefined;
}

const TS_SOURCE_PATTERN = /\.(?:[cm]?ts|tsx)$/i;

/**
 * The descriptor shim's emitted source.
 *
 * Exported so a regression can inspect the same bytes ttsx executes. This
 * template consumes its own escapes, so reading this file's text instead would
 * check characters no consumer ever sees — and a dropped backslash turns an
 * escape into the character it was escaping: a raw line terminator inside a
 * string literal, which stops the shim parsing and takes every descriptor load
 * with it. Its `@ttsc/lint` twin has carried that guard since the same defect
 * shipped there.
 */
export const PLUGIN_DESCRIPTOR_SHIM_SOURCE = [
  `// @ts-nocheck`,
  `import { writeFileSync } from "node:fs";`,
  `import { pathToFileURL } from "node:url";`,
  // The import is inside the try, not above it. A descriptor that cannot be
  // found, or whose module body throws, fails exactly where a descriptor
  // whose factory throws does, and a caller deserves the same reason for
  // both — "Cannot find module ./missing" is as actionable as anything the
  // factory could have said.
  `try {`,
  // Runtime hooks are installed before this shim loads. Arm their internal
  // side channel only for the descriptor import itself, after this shim's own
  // imports have resolved, so ttsc implementation files never become project
  // cache inputs.
  `  process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE = "1";`,
  `  const mod = await import(pathToFileURL(process.env.TTSC_PLUGIN_ENTRY).href);`,
  `  const context = JSON.parse(process.env.TTSC_PLUGIN_CONTEXT);`,
  `  const candidate = mod.createTtscPlugin ?? mod.default ?? mod.plugin ?? mod;`,
  `  const descriptor =`,
  `    typeof candidate === "function" ? candidate(context) : candidate;`,
  `  writeFileSync(process.env.TTSC_PLUGIN_DESCRIPTOR_OUT, JSON.stringify(descriptor));`,
  `} catch (error) {`,
  // The stack streams to the user's stderr on its own. This puts the reason
  // a caller can act on into the channel the parent already reads, so the
  // failure is not reduced to a bare exit status.
  // The escape is doubled on purpose: this template consumes one level, so
  // `\\n` here is what puts the two-character escape into the emitted shim.
  // A single `\n` would put a raw line terminator inside a string literal,
  // and the shim would stop parsing — taking every descriptor load with it.
  `  process.stderr.write((error instanceof Error && error.stack ? error.stack : String(error)) + "\\n");`,
  `  try {`,
  `    writeFileSync(process.env.TTSC_PLUGIN_DESCRIPTOR_OUT, JSON.stringify({ __ttscLoaderError: error instanceof Error ? error.message : String(error) }));`,
  `  } catch {}`,
  `  process.exit(1);`,
  `}`,
  ``,
].join("\n");

/**
 * Evaluate a `.ts` plugin descriptor entry in a child `ttsx` process and return
 * the descriptor it produces. A generated shim imports the entry, invokes its
 * factory with `context`, and writes the descriptor as JSON; `ttsx` runs the
 * shim with plugins disabled across the whole graph. Returns `undefined` when
 * `ttsx` is unavailable, so the caller can rethrow the original load error.
 */
function loadDescriptorViaTtsx(
  request: string,
  context: ITtscPluginFactoryContext,
  effectiveEnv: NodeJS.ProcessEnv,
): IsolatedPluginDescriptor | undefined {
  // Binary discovery prefers the instance environment, then the ambient
  // process.env (where `withPluginLoaderEnv` injects ttsc's own node/ttsx paths
  // just before this runs), then the running interpreter.
  const node = resolveNodeBinary(effectiveEnv, context.projectRoot);
  const ttsx = effectiveEnv.TTSC_TTSX_BINARY ?? process.env.TTSC_TTSX_BINARY;
  if (node === undefined || ttsx === undefined || ttsx.length === 0) {
    return undefined;
  }
  const dir = createEvaluationTempDir();
  const out = path.join(dir, "descriptor.json");
  const inputsOut = path.join(dir, "descriptor-inputs.ndjson");
  const shim = path.join(dir, "load-descriptor.mts");
  // ttsx type-checks and builds the shim's own project, so it needs a tsconfig
  // to anchor on; a minimal one is enough (the shim is `@ts-nocheck`).
  try {
    fs.writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          skipLibCheck: true,
          target: "es2022",
        },
      }),
    );
    fs.writeFileSync(shim, PLUGIN_DESCRIPTOR_SHIM_SOURCE);
    const result = childProcess.spawnSync(node, [ttsx, "--no-plugins", shim], {
      cwd: context.projectRoot,
      encoding: "utf8",
      env: {
        ...effectiveEnv,
        // Carry ttsc's own node/ttsx locators explicitly so the child (which
        // may recurse into further descriptor loads) finds them even when the
        // instance-env snapshot predates `withPluginLoaderEnv`.
        TTSC_NODE_BINARY: node,
        TTSC_TTSX_BINARY: ttsx,
        TTSC_PLUGIN_CONTEXT: JSON.stringify({
          binary: context.binary,
          cwd: context.cwd,
          dirname: context.dirname,
          filename: context.filename,
          plugin: context.plugin,
          pluginConfigDir: context.pluginConfigDir,
          projectRoot: context.projectRoot,
          tsconfig: context.tsconfig,
        }),
        TTSC_PLUGIN_DESCRIPTOR_LOAD: "1",
        TTSC_PLUGIN_DESCRIPTOR_OUT: out,
        TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT: inputsOut,
        TTSC_PLUGIN_ENTRY: request,
      },
      // Both child streams are human output, and they go straight to this
      // process's stderr as they are written. The descriptor itself travels
      // through a file, so nothing here needs collecting — and collecting it
      // only to replay it afterwards is what forced an invented output ceiling.
      stdio: ["ignore", 2, 2],
      windowsHide: true,
    });
    const processFailure = pluginDescriptorProcessFailure(result, request);
    if (processFailure) {
      // The descriptor's stack already reached the user's stderr as it ran.
      // What it could not put there is a reason a caller can act on, so that
      // arrives through the result file instead.
      const reason = pluginDescriptorFailureReason(out);
      throw reason === ""
        ? processFailure
        : new Error(`${processFailure.message}
${reason}`);
    }
    if (!fs.existsSync(out)) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" evaluation through ttsx produced no descriptor output.`,
      );
    }
    const text = fs.readFileSync(out, "utf8");
    try {
      const inputSnapshot = readTtsxDescriptorInputs(inputsOut, request);
      return {
        descriptor: JSON.parse(text),
        hostInputHashes: omitUnstableHostInputHashes(
          inputSnapshot.hostInputHashes,
          inputSnapshot.unstableInputs,
        ),
        hostInputRealpaths: inputSnapshot.hostInputRealpaths,
        inputs: inputSnapshot.inputs,
      };
    } catch (error) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" produced invalid JSON: ${errorMessage(error)}`,
      );
    }
  } finally {
    removeEvaluationTempDir(dir);
  }
}

interface TtsxDescriptorResolutionRecord {
  hash?: string | null;
  parent?: string;
  realpath?: string | null;
  resolved?: string;
  signature?: string;
  specifier?: string;
  unstable?: boolean;
}

/**
 * Expand the ttsx runtime's selected module edges into the same exact and
 * missing resolution inputs used by the direct isolated evaluator.
 */
function readTtsxDescriptorInputs(
  file: string,
  request: string,
): {
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  inputs: string[];
  unstableInputs: string[];
} {
  const inputs = new Set<string>([path.resolve(request)]);
  const hashes = new Map<string, string | null>();
  const realpaths = new Map<string, string | null>();
  const signatures = new Map<string, string>();
  const unstableInputs = new Set<string>();
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return {
      hostInputHashes: {},
      hostInputRealpaths: {},
      inputs: [...inputs],
      unstableInputs: [],
    };
  }
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let record: TtsxDescriptorResolutionRecord;
    try {
      record = JSON.parse(line) as TtsxDescriptorResolutionRecord;
    } catch {
      continue;
    }
    if (typeof record.resolved === "string") {
      const resolved = path.resolve(record.resolved);
      inputs.add(resolved);
      if (record.unstable === true) {
        hashes.delete(resolved);
        realpaths.delete(resolved);
        signatures.delete(resolved);
        unstableInputs.add(resolved);
        continue;
      }
      if (
        typeof record.signature !== "string" ||
        (signatures.has(resolved) &&
          signatures.get(resolved) !== record.signature)
      ) {
        hashes.delete(resolved);
        realpaths.delete(resolved);
        signatures.delete(resolved);
        unstableInputs.add(resolved);
        continue;
      }
      signatures.set(resolved, record.signature);
      if (
        (typeof record.realpath === "string" &&
          path.isAbsolute(record.realpath)) ||
        record.realpath === null
      ) {
        const observed =
          record.realpath === null ? null : path.resolve(record.realpath);
        if (realpaths.has(resolved) && realpaths.get(resolved) !== observed) {
          hashes.delete(resolved);
          realpaths.delete(resolved);
          signatures.delete(resolved);
          unstableInputs.add(resolved);
          continue;
        }
        realpaths.set(resolved, observed);
      }
      if (typeof record.hash === "string" || record.hash === null) {
        if (unstableInputs.has(resolved)) {
          // Keep a previously observed contradiction unstable.
        } else if (
          hashes.has(resolved) &&
          hashes.get(resolved) !== record.hash
        ) {
          hashes.delete(resolved);
          realpaths.delete(resolved);
          signatures.delete(resolved);
          unstableInputs.add(resolved);
        } else {
          hashes.set(resolved, record.hash);
        }
      }
    }
    if (
      typeof record.specifier === "string" &&
      typeof record.parent === "string"
    ) {
      for (const candidate of collectModuleResolutionCandidates(
        record.specifier,
        record.parent,
        record.resolved,
      )) {
        inputs.add(path.resolve(candidate));
      }
    }
  }
  for (const [resolved, observed] of realpaths) {
    if (
      realpathHostInput(resolved) === observed &&
      signatures.get(resolved) === hostInputMetadataSignature(resolved)
    ) {
      continue;
    }
    hashes.delete(resolved);
    realpaths.delete(resolved);
    signatures.delete(resolved);
    unstableInputs.add(resolved);
  }
  return {
    hostInputHashes: Object.fromEntries(hashes),
    hostInputRealpaths: Object.fromEntries(realpaths),
    inputs: [...inputs].sort(),
    unstableInputs: [...unstableInputs],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withPluginLoaderEnv<T>(run: () => T): T {
  const previousNode = process.env.TTSC_NODE_BINARY;
  const previousTtsx = process.env.TTSC_TTSX_BINARY;
  const node = resolveNodeBinary({}, process.cwd());
  if (process.env.TTSC_NODE_BINARY === undefined && node !== undefined) {
    process.env.TTSC_NODE_BINARY = node;
  }
  process.env.TTSC_TTSX_BINARY ??= path.join(
    __dirname,
    "..",
    "..",
    "launcher",
    "ttsx.js",
  );
  try {
    return run();
  } finally {
    restoreEnv("TTSC_NODE_BINARY", previousNode);
    restoreEnv("TTSC_TTSX_BINARY", previousTtsx);
  }
}

/**
 * Select the executable for isolated descriptor evaluation.
 *
 * Under Bun, `process.execPath` names Bun itself. Bun implements enough of the
 * Node module surface to evaluate descriptors natively, but not Node's
 * synchronous `module.registerHooks` preload. The caller therefore recognizes
 * this default and omits the Node-only preload while retaining the fresh
 * process boundary. An explicitly configured Node executable remains
 * authoritative and receives the preload as usual.
 */
function pluginDescriptorRuntimeBinary(env: NodeJS.ProcessEnv): string {
  if (
    env.TTSC_NODE_BINARY === undefined &&
    typeof (process.versions as Record<string, string | undefined>).bun ===
      "string"
  ) {
    return process.execPath;
  }
  return (
    env.TTSC_NODE_BINARY ?? process.env.TTSC_NODE_BINARY ?? process.execPath
  );
}

/** Replay a child's human output without imposing a fixed output ceiling. */
function replayEvaluationDiagnostics(file: string): void {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, "r");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    for (;;) {
      const length = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (length === 0) break;
      fs.writeSync(2, buffer, 0, length);
    }
  } catch {
    // Diagnostic replay must never replace the descriptor result.
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function restoreEnv(
  key: "TTSC_NODE_BINARY" | "TTSC_TTSX_BINARY",
  value: string | undefined,
): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function isTtscPlugin(value: unknown): value is ITtscPlugin {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectJsTransformFunctions(
  specifier: string,
  candidate: object,
): void {
  if ("transformSource" in candidate || "transformOutput" in candidate) {
    throw new Error(
      `ttsc: plugin "${specifier}" declares unsupported JS transform functions; ` +
        "declare a native backend instead",
    );
  }
}

function resolvePluginStage(plugin: ITtscPlugin): TtscPluginStage {
  if (plugin.stage === undefined) {
    return "transform";
  }
  if (!isPluginStage(plugin.stage)) {
    if (plugin.stage === "output") {
      throw new Error(
        `ttsc: plugin "${plugin.name}" requested removed stage "output"; ` +
          "upgrade the plugin to a transform-stage descriptor compatible with this ttsc version",
      );
    }
    throw new Error(
      `ttsc: plugin "${plugin.name}" requested unsupported stage ${JSON.stringify(plugin.stage)}`,
    );
  }
  return plugin.stage;
}

function validatePluginSource(plugin: ITtscPlugin): void {
  if (typeof plugin.source !== "string" || plugin.source.length === 0) {
    throw new Error(`ttsc: plugin must declare source`);
  }
}

function pluginLabel(
  plugin: ITtscPlugin,
  config: ITtscProjectPluginConfig,
  index: number,
): string {
  if (typeof plugin.name === "string" && plugin.name.length !== 0) {
    return plugin.name;
  }
  if (typeof config.transform === "string" && config.transform.length !== 0) {
    return config.transform;
  }
  return `#${index}`;
}

function resolvePluginSource(source: string, projectRoot: string): string {
  return resolveRealPath(
    path.isAbsolute(source) ? source : path.resolve(projectRoot, source),
  );
}

function resolveNativeSourceKind(
  source: string,
  plugin: ITtscPlugin,
  config: ITtscProjectPluginConfig,
  index: number,
): "executable" | "linked" {
  const packageDir = resolveGoPackageDir(
    source,
    pluginLabel(plugin, config, index),
  );
  if (findNearestGoMod(packageDir, GO_MOD_SEARCH_MAX_DEPTH) === null) {
    throw new Error(
      `ttsc: plugin "${pluginLabel(plugin, config, index)}" source must be inside a Go module with go.mod within ${GO_MOD_SEARCH_MAX_DEPTH} parent directories: ${source}`,
    );
  }
  const packageName = readGoPackageName(packageDir);
  if (packageName === null) {
    throw new Error(
      `ttsc: plugin "${pluginLabel(plugin, config, index)}" source must contain at least one non-test ".go" file with a package declaration: ${packageDir}`,
    );
  }
  return packageName === "main" ? "executable" : "linked";
}

function resolveGoPackageDir(source: string, label: string): string {
  if (!fs.existsSync(source)) {
    // A descriptor factory runs without CommonJS globals when ttsc loads it
    // through ttsx or as ESM — `__dirname`/`__filename`/`require` are undefined,
    // so a `source` derived from them mis-resolves (often against cwd) and lands
    // here. Name that failure mode explicitly instead of leaving a bare
    // not-found path: the breakage is otherwise silent. (See #248.)
    throw new Error(
      `ttsc: plugin "${label}" source does not exist: ${source}\n` +
        `  Plugin descriptors run without CommonJS globals: __dirname, __filename, ` +
        `and require are undefined when ttsc loads a descriptor through ttsx or as ESM. ` +
        `If this path was derived from one of them, use context.dirname / ` +
        `context.filename (the descriptor's own directory and file, populated in ` +
        `every load mode), or resolve it from context.projectRoot, e.g. ` +
        `createRequire(path.join(context.projectRoot, "package.json"))` +
        `.resolve("<your-package>/package.json").`,
    );
  }
  const stat = fs.statSync(source);
  if (stat.isFile() && path.basename(source) === "go.mod") {
    return path.dirname(source);
  }
  if (stat.isDirectory()) {
    return source;
  }
  throw new Error(
    `ttsc: plugin "${label}" source must be a Go package directory or go.mod file: ${source}`,
  );
}

function readGoPackageName(dir: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      !entry.name.endsWith(".go") ||
      entry.name.endsWith("_test.go")
    ) {
      continue;
    }
    const file = path.join(dir, entry.name);
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*package\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(line);
      if (match) {
        return match[1]!;
      }
    }
  }
  return null;
}

const CONTRIBUTOR_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

function validatePluginContributors(
  plugin: ITtscPlugin,
): readonly { name: string; source: string }[] | undefined {
  const contributors = plugin.contributors;
  if (contributors === undefined) return undefined;
  if (!Array.isArray(contributors)) {
    throw new Error(
      `ttsc: plugin "${plugin.name}" "contributors" must be an array of { name, source } entries`,
    );
  }
  if (contributors.length === 0) return undefined;
  const seen = new Set<string>();
  const out: { name: string; source: string }[] = [];
  for (const [index, entry] of contributors.entries()) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}] must be an object`,
      );
    }
    const { name, source } = entry as { name?: unknown; source?: unknown };
    if (typeof name !== "string" || !CONTRIBUTOR_NAME_PATTERN.test(name)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].name must match /^[a-z][a-z0-9_]*$/; ` +
          `got ${JSON.stringify(name)}`,
      );
    }
    if (seen.has(name)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}] duplicate name ${JSON.stringify(name)}`,
      );
    }
    seen.add(name);
    if (typeof source !== "string" || source.length === 0) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must be a non-empty string`,
      );
    }
    if (!path.isAbsolute(source)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must be an absolute path; ` +
          `got ${JSON.stringify(source)}`,
      );
    }
    if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must be an existing directory: ${source}`,
      );
    }
    // Pre-flight check that the directory actually carries a buildable
    // contributor package. Without this, an accidentally-empty directory
    // (or a directory containing only `_test.go` files, which `go build`
    // silently skips) reaches the synthesized blank-import step and Go's
    // compile error surfaces with a scratch-tempdir path that doesn't
    // name the contributor entry. Catching it here lets us name the
    // entry the user actually authored.
    if (!hasBuildableGoSource(source)) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" contributors[${index}].source must contain at least one non-test ".go" file: ${source}`,
      );
    }
    out.push({ name, source: resolveRealPath(source) });
  }
  return out;
}

function mergeContributors(
  first: readonly ITtscPluginContributor[] | undefined,
  second: readonly ITtscPluginContributor[] | undefined,
): readonly ITtscPluginContributor[] | undefined {
  const out = [...(first ?? []), ...(second ?? [])];
  return out.length === 0 ? undefined : out;
}

function isPluginStage(value: string): value is TtscPluginStage {
  return value === "transform" || value === "check";
}

function hasBuildableGoSource(dir: string): boolean {
  // `go build` consumes `.go` files but silently ignores `_test.go`. A
  // contributor whose source dir holds only test files would compile to
  // an empty package and surface as an opaque scratch-tempdir error;
  // require at least one production `.go` file so the validator can
  // name the contributor entry instead.
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return false;
  }
  return entries.some(
    (name) => name.endsWith(".go") && !name.endsWith("_test.go"),
  );
}

function resolvePluginRequest(specifier: string, projectRoot: string): string {
  if (path.isAbsolute(specifier)) {
    return resolveRealPath(specifier);
  }
  if (isRelativePluginSpecifier(specifier)) {
    return resolveRealPath(path.resolve(projectRoot, specifier));
  }
  // A package whose main `.` entry is a runtime barrel cannot double as a
  // plugin descriptor entry: loading it during plugin bootstrap drags the
  // runtime in (and, for a self-hosting transform like typia, deadlocks —
  // loading the transform would have to build the runtime the transform
  // emits). Such a package opts in with a `ttsc` export condition that points
  // at a runtime-free descriptor; honour it here, scoped to plugin resolution.
  const conditioned = resolvePluginExportCondition(specifier, projectRoot);
  if (conditioned !== null) {
    return conditioned;
  }
  return resolveRealPath(require.resolve(specifier, { paths: [projectRoot] }));
}

/**
 * Condition names ttsc activates when resolving a plugin entry's package
 * `exports`.
 */
const PLUGIN_EXPORT_CONDITIONS: readonly string[] = [
  "ttsc",
  "node",
  "require",
  "default",
];

/**
 * Resolve a bare plugin specifier under the dedicated `ttsc` export condition.
 *
 * A package whose `.` entry is a runtime barrel (e.g. `typia`, whose index
 * re-exports the whole validator runtime) cannot serve as the plugin descriptor
 * entry: loading it during plugin bootstrap pulls the runtime in and, for a
 * self-hosting transform, forms a cycle. Such a package opts in by adding a
 * `ttsc` condition to its `exports` that points at a runtime-free descriptor:
 *
 * "exports": { ".": { "ttsc": "./lib/transform.js", "default": "./lib/index.js"
 * } }
 *
 * The condition is honoured ONLY here, scoped to plugin-entry resolution. A
 * process-wide `--conditions=ttsc` would also redirect the package's normal
 * `import`s to the descriptor and break its runtime, so it must not be used.
 *
 * Returns an absolute path when the package opts in, or `null` to fall back to
 * the normal `require.resolve` — no `exports`, no `ttsc` branch for the
 * requested subpath, or an unresolved/missing target — so a package that does
 * not opt in resolves exactly as it did before.
 */
function resolvePluginExportCondition(
  specifier: string,
  baseDir: string,
): string | null {
  const split = splitPackageSpecifier(specifier);
  if (split === null) {
    return null;
  }
  const packageJson = resolveDependencyPackageJson(split.packageName, baseDir);
  if (packageJson === undefined) {
    return null;
  }
  const exportsField = readPackageManifest(packageJson)?.exports;
  if (exportsField === undefined) {
    return null;
  }
  const target = selectExportTarget(exportsField, split.subpath);
  // Only take over when the package actually opts in with a `ttsc` condition
  // for this subpath; otherwise defer so behaviour is unchanged for every
  // package that does not.
  if (target === undefined || !containsCondition(target, "ttsc")) {
    return null;
  }
  const resolved = resolveConditionalTarget(target, PLUGIN_EXPORT_CONDITIONS);
  if (resolved === null || !resolved.startsWith("./")) {
    return null;
  }
  const file = path.resolve(path.dirname(packageJson), resolved);
  return existingFile(file) ? resolveRealPath(file) : null;
}

/**
 * Split a bare specifier into its package name and the `.`-prefixed subpath it
 * addresses (`"typia"` → `.`, `"typia/lib/transform"` → `./lib/transform`,
 * `"@scope/pkg/sub"` → `./sub`). Returns `null` for a relative/empty specifier
 * or a malformed scoped name.
 */
function splitPackageSpecifier(
  specifier: string,
): { packageName: string; subpath: string } | null {
  if (specifier.length === 0 || specifier.startsWith(".")) {
    return null;
  }
  const segments = specifier.split("/");
  const nameSegments = specifier.startsWith("@") ? 2 : 1;
  if (segments.length < nameSegments) {
    return null;
  }
  const rest = segments.slice(nameSegments).join("/");
  return {
    packageName: segments.slice(0, nameSegments).join("/"),
    subpath: rest.length === 0 ? "." : `./${rest}`,
  };
}

/**
 * The `exports` entry addressing `subpath`, applying Node's rule that an
 * `exports` value with no `.`-prefixed keys is sugar for the `.` target.
 * Returns `undefined` when no entry addresses the subpath.
 */
function selectExportTarget(exportsField: unknown, subpath: string): unknown {
  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    return subpath === "." ? exportsField : undefined;
  }
  if (typeof exportsField !== "object" || exportsField === null) {
    return undefined;
  }
  const record = exportsField as Record<string, unknown>;
  const isSubpathMap = Object.keys(record).some(
    (key) => key === "." || key.startsWith("./"),
  );
  if (!isSubpathMap) {
    // Conditions object: the whole value is the `.` target.
    return subpath === "." ? exportsField : undefined;
  }
  if (
    Object.prototype.hasOwnProperty.call(record, subpath) &&
    !subpath.includes("*") &&
    !subpath.endsWith("/")
  ) {
    return record[subpath];
  }
  const patterns = Object.keys(record)
    .filter((key) => exportPatternReplacement(key, subpath) !== undefined)
    .sort(compareExportPatternKeys);
  if (patterns.length === 0) {
    return undefined;
  }
  const pattern = patterns[0]!;
  return substituteExportTarget(
    record[pattern],
    exportPatternReplacement(pattern, subpath)!,
  );
}

/** Capture the middle of one valid single-star exports key. */
function exportPatternReplacement(
  pattern: string,
  subpath: string,
): string | undefined {
  const star = pattern.indexOf("*");
  if (
    !pattern.startsWith("./") ||
    star === -1 ||
    pattern.indexOf("*", star + 1) !== -1
  ) {
    return undefined;
  }
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (
    subpath.length < pattern.length ||
    !subpath.startsWith(prefix) ||
    !subpath.endsWith(suffix)
  ) {
    return undefined;
  }
  return subpath.slice(prefix.length, subpath.length - suffix.length);
}

/** Node exports patterns rank longer prefixes, then longer full keys, first. */
function compareExportPatternKeys(left: string, right: string): number {
  const leftPrefix = left.indexOf("*");
  const rightPrefix = right.indexOf("*");
  if (leftPrefix !== rightPrefix) {
    return rightPrefix - leftPrefix;
  }
  return right.length - left.length;
}

/** Substitute the selected pattern capture into every string target branch. */
function substituteExportTarget(target: unknown, replacement: string): unknown {
  if (typeof target === "string") {
    return target.split("*").join(replacement);
  }
  if (Array.isArray(target)) {
    return target.map((entry) => substituteExportTarget(entry, replacement));
  }
  if (typeof target !== "object" || target === null) {
    return target;
  }
  return Object.fromEntries(
    Object.entries(target).map(([condition, value]) => [
      condition,
      substituteExportTarget(value, replacement),
    ]),
  );
}

/** True when condition key `condition` appears anywhere in a (nested) target. */
function containsCondition(target: unknown, condition: string): boolean {
  if (Array.isArray(target)) {
    return target.some((entry) => containsCondition(entry, condition));
  }
  if (typeof target !== "object" || target === null) {
    return false;
  }
  return Object.entries(target).some(
    ([key, value]) => key === condition || containsCondition(value, condition),
  );
}

/**
 * Resolve a (possibly conditional) export target to a relative file string,
 * honouring `conditions` — a string is the target, an array is a fallback list,
 * an object picks the first key in the active condition set (package key order
 * wins, as Node does), and an explicit `null` blocks the target.
 */
function resolveConditionalTarget(
  target: unknown,
  conditions: readonly string[],
): string | null {
  if (typeof target === "string") {
    return target;
  }
  if (target === null || target === undefined) {
    return null;
  }
  if (Array.isArray(target)) {
    for (const entry of target) {
      const resolved = resolveConditionalTarget(entry, conditions);
      if (resolved !== null) {
        return resolved;
      }
    }
    return null;
  }
  if (typeof target !== "object") {
    return null;
  }
  const active = new Set(conditions);
  for (const [key, value] of Object.entries(
    target as Record<string, unknown>,
  )) {
    if (active.has(key)) {
      const resolved = resolveConditionalTarget(value, conditions);
      if (resolved !== null) {
        return resolved;
      }
    }
  }
  return null;
}

function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}

function isRelativePluginSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}

let cachedTtscVersion: string | null = null;

function readTtscVersion(): string {
  if (cachedTtscVersion !== null) {
    return cachedTtscVersion;
  }
  try {
    const file = path.join(ttscPackageRoot(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
      version?: string;
    };
    cachedTtscVersion = pkg.version ?? "0.0.0";
  } catch {
    cachedTtscVersion = "0.0.0";
  }
  return cachedTtscVersion;
}

function ttscPackageRoot(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

function readTsgoVersion(projectRoot: string): string {
  try {
    const projectRequire = createRequire(
      path.join(projectRoot, "package.json"),
    );
    const pkgPath = projectRequire.resolve("typescript/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Create an evaluator directory whose cleanup path cannot follow a retargeted
 * parent alias.
 */
function createEvaluationTempDir(): string {
  return createCanonicalTempDirectory("ttsc-plugin-descriptor-");
}

/**
 * Remove an evaluation temp directory without letting cleanup replace a result.
 *
 * This runs from a `finally`, so a throw here would surface instead of the
 * evaluation's own outcome — and on Windows a grandchild that inherited a
 * handle, or a scanner holding the file, can make removal fail. Leaving bytes
 * in the system temp directory is by far the lesser outcome.
 */
function removeEvaluationTempDir(directory: string): void {
  try {
    fs.rmSync(directory, { force: true, recursive: true });
  } catch {
    // Best effort.
  }
}
