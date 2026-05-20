import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { findNearestGoMod } from "../../compiler/internal/paths";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import type { ITtscPlugin } from "../../structures/ITtscPlugin";
import type { ITtscPluginContributor } from "../../structures/ITtscPluginContributor";
import type { ITtscPluginFactoryContext } from "../../structures/ITtscPluginFactoryContext";
import type { ITtscProjectPluginConfig } from "../../structures/ITtscProjectPluginConfig";
import type { TtscPluginStage } from "../../structures/TtscPluginStage";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import { buildSourcePlugin } from "./buildSourcePlugin";

const GO_MOD_SEARCH_MAX_DEPTH = 3;

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

/**
 * Resolve, load, and build all native plugin sidecars for a TypeScript project.
 *
 * Reads the project config, discovers plugin entries (from tsconfig and package
 * auto-discovery), validates and composes their descriptors, then invokes
 * `buildSourcePlugin` to compile each Go source package into a cached binary.
 * Returns the ordered set of loaded native plugins alongside the parsed project
 * config.
 *
 * @param options.binary - Absolute path to the ttsc native helper binary.
 * @param options.cacheDir - Override the plugin binary cache directory.
 * @param options.cwd - Working directory for resolving relative paths.
 * @param options.entries - Explicit plugin entries; `false` disables all
 *   plugins (skips both tsconfig entries and package auto-discovery).
 * @param options.file - Path to the tsconfig/jsconfig file.
 * @param options.projectRoot - Override the project root directory.
 * @param options.tsconfig - Alias for `file`.
 */
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
    return {
      contributors,
      config: entries[index]!.config,
      kind,
      label: pluginLabel(plugin, entries[index]!.config, index),
      linkedContributorName,
      name: plugin.name,
      source,
      stage,
    };
  });
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
      config: record.config,
      contributors: record.contributors,
      kind: record.kind,
      name: record.name,
      source: record.source,
      stage: record.stage,
    };
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
    throw new Error(`ttsc: plugin "${label}" source does not exist: ${source}`);
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
