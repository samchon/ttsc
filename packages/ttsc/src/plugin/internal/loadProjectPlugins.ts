import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import type { ITtscPlugin } from "../../structures/ITtscPlugin";
import type { ITtscPluginFactoryContext } from "../../structures/ITtscPluginFactoryContext";
import type { ITtscProjectPluginConfig } from "../../structures/ITtscProjectPluginConfig";
import type { TtscPluginStage } from "../../structures/TtscPluginStage";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import { buildSourcePlugin } from "./buildSourcePlugin";

type TtscPluginFactory<T = ITtscProjectPluginConfig> = (
  context: ITtscPluginFactoryContext<T>,
) => ITtscPlugin;

type ProjectPluginEntry = {
  baseDir: string;
  config: ITtscProjectPluginConfig;
};

type PackageManifest = {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  name?: unknown;
  ttsc?: unknown;
};

export function loadProjectPlugins(options: {
  binary: string;
  cacheDir?: string;
  cwd?: string;
  entries?: readonly ITtscProjectPluginConfig[] | false;
  file?: string;
  projectRoot?: string;
  tsconfig?: string;
}): {
  nativePlugins: ITtscLoadedNativePlugin[];
  project: ITtscParsedProjectConfig;
} {
  const project = readProjectConfig({
    cwd: options.cwd,
    file: options.file,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  const entries: ProjectPluginEntry[] =
    options.entries === false
      ? []
      : resolvePluginEntries(project, options.entries).filter(
          (entry) => entry.config.enabled !== false,
        );
  if (entries.length === 0) {
    return {
      nativePlugins: [],
      project,
    };
  }

  const context = {
    binary: options.binary,
    cwd: path.resolve(options.cwd ?? process.cwd()),
    projectRoot: project.root,
    tsconfig: project.path,
  };
  const plugins = composePluginSources(
    entries,
    entries.map((entry) =>
    loadPluginEntry(
      entry.config,
      { ...context, plugin: entry.config },
      entry.baseDir,
    ),
    ),
  );

  const nativePlugins: ITtscLoadedNativePlugin[] = [];
  const ttscVersion = readTtscVersion();
  const tsgoVersion = readTsgoVersion(context.projectRoot);
  plugins.forEach((plugin, index) => {
    const stage = resolvePluginStage(plugin);
    validatePluginSource(plugin);
    const binary = buildSourcePlugin({
      baseDir: context.projectRoot,
      cacheDir: options.cacheDir,
      pluginName: plugin.name,
      source: plugin.source,
      ttscVersion,
      tsgoVersion,
    });
    nativePlugins.push({
      binary,
      config: entries[index]!.config,
      name: plugin.name,
      source: plugin.source,
      stage,
    });
  });
  return {
    nativePlugins: orderNativePlugins(nativePlugins),
    project,
  };
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
  return plugins.map((plugin, index) => {
    const transform = entries[index]?.config.transform;
    const aggregate = aggregates.find(
      ({ index: aggregateIndex, plugin: aggregatePlugin }) =>
        aggregateIndex !== index &&
        aggregatePlugin.composes!.some(
          (alias) =>
            alias === plugin.name ||
            (typeof transform === "string" && alias === transform),
        ),
    );
    return aggregate === undefined
      ? plugin
      : {
          ...plugin,
          source: aggregate.plugin.source,
        };
  });
}

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
  const configured = project.compilerOptions.plugins.map((config, index) => ({
    baseDir: project.pluginBaseDirs[index] ?? project.root,
    config,
  }));
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
  if (fs.existsSync(directManifest)) {
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
  let current = fs.statSync(location).isDirectory()
    ? location
    : path.dirname(location);
  while (true) {
    const manifest = path.join(current, "package.json");
    if (fs.existsSync(manifest)) {
      return resolveRealPath(manifest);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function readPackageManifest(file: string): PackageManifest | undefined {
  if (!fs.existsSync(file)) {
    return undefined;
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
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
  context: ITtscPluginFactoryContext,
  baseDir: string,
): ITtscPlugin {
  const specifier = entry.transform;
  if (typeof specifier !== "string" || specifier.length === 0) {
    throw new Error(`ttsc: plugin entry is missing a string "transform" field`);
  }

  const request = resolvePluginRequest(specifier, baseDir);
  const mod = require(request) as {
    createTtscPlugin?: TtscPluginFactory;
    default?: ITtscPlugin | TtscPluginFactory;
  } & Partial<Record<"plugin", ITtscPlugin | TtscPluginFactory>>;
  const candidate =
    mod.createTtscPlugin ??
    mod.default ??
    mod.plugin ??
    (mod as unknown as ITtscPlugin | TtscPluginFactory);
  if (typeof candidate === "function") {
    const plugin = candidate(context);
    if (!isTtscPlugin(plugin)) {
      throw new Error(
        `ttsc: plugin "${specifier}" does not export a valid ttsc plugin`,
      );
    }
    rejectJsTransformFunctions(specifier, plugin);
    return plugin;
  }
  if (isTtscPlugin(candidate)) {
    rejectJsTransformFunctions(specifier, candidate);
    return candidate;
  }
  throw new Error(
    `ttsc: plugin "${specifier}" does not export a valid ttsc plugin`,
  );
}

function isTtscPlugin(value: unknown): value is ITtscPlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string"
  );
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
    throw new Error(`ttsc: plugin "${plugin.name}" must declare source`);
  }
}

function isPluginStage(value: string): value is TtscPluginStage {
  return value === "transform" || value === "check";
}

function resolvePluginRequest(specifier: string, projectRoot: string): string {
  if (path.isAbsolute(specifier)) {
    return resolveRealPath(specifier);
  }
  if (isRelativePluginSpecifier(specifier)) {
    return resolveRealPath(path.resolve(projectRoot, specifier));
  }
  return resolveRealPath(require.resolve(specifier, { paths: [projectRoot] }));
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
    const file = path.resolve(__dirname, "..", "..", "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
      version?: string;
    };
    cachedTtscVersion = pkg.version ?? "0.0.0";
  } catch {
    cachedTtscVersion = "0.0.0";
  }
  return cachedTtscVersion;
}

function readTsgoVersion(projectRoot: string): string {
  try {
    const projectRequire = createRequire(
      path.join(projectRoot, "package.json"),
    );
    const pkgPath = projectRequire.resolve(
      "@typescript/native-preview/package.json",
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
