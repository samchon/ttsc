import childProcess from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findNearestGoMod } from "../../../compiler/internal/findNearestGoMod";
import { readJsonFile } from "../../../compiler/internal/project/readJsonFile";
import { readProjectConfig } from "../../../compiler/internal/project/readProjectConfig";
import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { javascriptRuntimeCapabilities } from "../../../internal/javascriptRuntimeCapabilities";
import { resolveNodeBinary } from "../../../internal/resolveNodeBinary";
import { spawnSyncResilient } from "../../../internal/spawnSyncResilient";
import type { ITtscPlugin } from "../../../structures/ITtscPlugin";
import type { ITtscPluginContributor } from "../../../structures/ITtscPluginContributor";
import type { ITtscPluginFactoryContext } from "../../../structures/ITtscPluginFactoryContext";
import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import type { TtscPluginStage } from "../../../structures/TtscPluginStage";
import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import { pluginDescriptorFailureReason } from "../pluginDescriptorFailureReason";
import { pluginDescriptorProcessFailure } from "../pluginDescriptorProcessFailure";
import { buildSourcePlugin } from "../source/buildSourcePlugin";
import { isPathWithin } from "../source/isPathWithin";
import { COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE } from "./COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE";
import { PLUGIN_DESCRIPTOR_SHIM_SOURCE } from "./PLUGIN_DESCRIPTOR_SHIM_SOURCE";
import { PluginPackageResolution } from "./PluginPackageResolution";
import { ProjectPluginEntries } from "./ProjectPluginEntries";
import { collectProjectHostInputs } from "./collectProjectHostInputs";
import { hashHostInputPaths } from "./hashHostInputPaths";
import { realpathHostInput } from "./realpathHostInput";
import { realpathHostInputPaths } from "./realpathHostInputPaths";

/**
 * Resolve, load, and build all native plugin sidecars for a TypeScript project.
 *
 * Reads the project config, discovers plugin entries (from tsconfig and package
 * auto-discovery), validates and composes their descriptors, then invokes
 * `buildSourcePlugin` to compile each Go source package into a cached binary.
 * Returns the ordered native plugins, parsed project config, exact
 * JavaScript-host files that universally influence the loaded selection, and
 * the state of every Go source directory the plugins supplied to the builds
 * (`pluginSources`, samchon/ttsc#1487): each plugin's module root and each
 * contributor's source, with its digest (`pluginSourceDigest`) as the build
 * read it. ttsc's own sources, its overlays and the host it builds for linked
 * plugins, are keyed too but not reported: they change only with ttsc itself.
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
  deferredHostInputs: string[];
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
  nativePlugins: ITtscLoadedNativePlugin[];
  pluginSources: Record<string, string>;
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
  const entries: ProjectPluginEntries.ProjectPluginEntry[] =
    options.entries === false
      ? []
      : ProjectPluginEntries.resolvePluginEntries(
          project,
          options.entries,
        ).filter((entry) => entry.config.enabled !== false);
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
      pluginSources: {},
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
      const request = PluginPackageResolution.resolvePluginRequest(
        specifier,
        entry.baseDir,
      );
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
  // One reading of each source directory, shared by every build below and
  // reported as the state the binaries were keyed on.
  const sourceDigests = new Map<string, string>();
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
        sourceDigests,
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
          sourceDigests,
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
              sourceDigests,
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
    // ttsc's own sources change only with ttsc, whose version its consumer
    // already runs; reporting them would have every consumer read and watch
    // the whole installed package as if it were a plugin's.
    pluginSources: Object.fromEntries(
      [...sourceDigests]
        .filter(([directory]) => !isPathWithin(directory, ttscPackageRoot()))
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    ),
    project,
  };
}

const GO_MOD_SEARCH_MAX_DEPTH = 3;

type ProjectHostInputSnapshot = {
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
  project: ITtscParsedProjectConfig;
};

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
  deferredHostInputs: string[];
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
} {
  const inputs = new Set<string>(
    baselineInputs.map((file) => path.resolve(file)),
  );
  // A path consumed by any JavaScript-host stage keeps that stage's proof
  // obligation, even when another plugin merely forwards the same spelling as
  // its conventional native `configFile`. Otherwise one non-consuming record
  // could let the native result replace a missing/raced JavaScript proof for a
  // different record that really read the file.
  const consumed = new Set<string>(
    baselineInputs.map((file) => path.resolve(file)),
  );
  for (const record of records) {
    for (const hostInput of record.hostInputs) {
      consumed.add(path.resolve(hostInput));
    }
  }
  const deferred = new Set<string>();
  const configBase = context.pluginConfigDir ?? path.dirname(project.path);
  for (const record of records) {
    inputs.add(path.resolve(record.request));
    for (const hostInput of record.hostInputs) {
      inputs.add(path.resolve(hostInput));
    }
    const descriptorManifest = PluginPackageResolution.findNearestPackageJson(
      record.request,
    );
    if (descriptorManifest !== undefined) {
      inputs.add(path.resolve(descriptorManifest));
    }
    const configFile = record.config.configFile;
    if (typeof configFile === "string" && configFile.trim() !== "") {
      const absolute = path.isAbsolute(configFile)
        ? path.resolve(configFile)
        : path.resolve(configBase, configFile);
      inputs.add(absolute);
      // `configFile` is a convention forwarded to the native plugin, not a
      // file the JavaScript loader reads. Its compile-time proof must therefore
      // come back from that plugin. A descriptor that separately reports the
      // same path did consume it here and remains subject to its own proof.
      if (!consumed.has(absolute)) {
        deferred.add(absolute);
      }
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
  return {
    deferredHostInputs: [...deferred].sort(),
    hostInputHashes,
    hostInputRealpaths,
    hostInputs,
  };
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
    if (PluginPackageResolution.isRecord(value)) {
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
      if (PluginPackageResolution.isRecord(manifest)) {
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
          (resolvedFile === undefined &&
            PluginPackageResolution.existingFile(base))
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

function composePluginSources(
  entries: readonly ProjectPluginEntries.ProjectPluginEntry[],
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
    if (
      !PluginPackageResolution.isRecord(parsed) ||
      !Array.isArray(parsed.inputs)
    ) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" produced an invalid isolated result`,
      );
    }
    const parsedHashes = PluginPackageResolution.isRecord(parsed.inputHashes)
      ? Object.fromEntries(
          Object.entries(parsed.inputHashes).flatMap(([file, hash]) =>
            typeof hash === "string" || hash === null
              ? [[path.resolve(file), hash]]
              : [],
          ),
        )
      : {};
    const parsedRealpaths = PluginPackageResolution.isRecord(
      parsed.inputRealpaths,
    )
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
    !PluginPackageResolution.isRecord(plugin.hostInputHashes) ||
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
    !PluginPackageResolution.isRecord(plugin.hostInputRealpaths) ||
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

/** Read the isolated loader's explicit retry classification. */
function commonJsDescriptorRetryWithTtsx(file: string): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return (
      PluginPackageResolution.isRecord(parsed) &&
      parsed.__ttscRetryWithTtsx === true
    );
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
  return PluginPackageResolution.resolveRealPath(
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
    out.push({ name, source: PluginPackageResolution.resolveRealPath(source) });
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
  return path.resolve(__dirname, "..", "..", "..", "..");
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
