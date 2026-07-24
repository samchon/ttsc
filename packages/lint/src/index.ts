import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { ITtscLintPlugin, ITtscLintPluginConfig } from "./structures";

export * from "./defaultFormat";
export * from "./structures/index";

/** A resolved contributor: Go sub-package name + absolute source directory. */
type TtscPluginContributor = {
  name: string;
  source: string;
};

/** Descriptor shape returned to ttsc's plugin builder by the factory. */
type TtscPluginDescriptor = {
  capabilities?: {
    diagnosticsTiming?: boolean;
    lsp?: boolean;
    projectContextArgs?: boolean;
    projectDiagnostics?: boolean;
    projectInputs?: boolean;
    residentCheck?: boolean;
    threadingArgs?: boolean;
  };
  contributors?: TtscPluginContributor[];
  name: string;
  reportsTypeScriptDiagnostics?: boolean;
  source: string;
  stage?: "check" | "transform";
};

/**
 * Context object injected by ttsc into every plugin factory call. The generic
 * `TConfig` is the tsconfig plugin entry shape.
 */
type TtscPluginFactoryContext<TConfig> = {
  binary: string;
  cwd: string;
  /** This descriptor's own directory — the ESM-safe replacement for `__dirname`. */
  dirname: string;
  /** This descriptor's own path — the ESM-safe replacement for `__filename`. */
  filename: string;
  plugin: TConfig;
  /**
   * Caller-declared anchor for plugin config-file discovery, present when the
   * embedder compiles through a generated tsconfig outside the project (see
   * `ITtscPluginFactoryContext.pluginConfigDir`).
   */
  pluginConfigDir?: string;
  projectRoot: string;
  tsconfig: string;
};

// Namespace becomes the rule-name prefix (`<ns>/<rule>`). Mirrors ESLint
// plugin namespace conventions: lowercase ASCII, digits, hyphens, and
// underscores; leading character must be alphabetic so the prefix never
// collides with a rule name that itself starts with a digit. Hyphens
// are encoded into underscores for the Go sub-package name (see
// `goSubpackageName`); the user-facing prefix keeps the original form.
const NAMESPACE_PATTERN = /^[a-z][a-z0-9_-]*$/;

/**
 * Map a user-facing namespace (`react-hooks`) to a Go-valid sub-package name
 * (`react_hooks`). Required because ttsc's plugin builder uses the `name` field
 * as a directory and import-path suffix, both of which must satisfy Go's
 * stricter `[a-z][a-z0-9_]*` identifier rules. The function is total over
 * namespaces that already passed `NAMESPACE_PATTERN`.
 */
function goSubpackageName(namespace: string): string {
  return namespace.replace(/-/g, "_");
}

const LINT_CONFIG_FILENAMES = [
  "lint.config.ts",
  "lint.config.mts",
  "lint.config.cts",
  "lint.config.mjs",
  "lint.config.cjs",
  "lint.config.js",
  "lint.config.json",
  "ttsc-lint.config.ts",
  "ttsc-lint.config.mts",
  "ttsc-lint.config.cts",
  "ttsc-lint.config.mjs",
  "ttsc-lint.config.cjs",
  "ttsc-lint.config.js",
  "ttsc-lint.config.json",
];

/**
 * Tsconfig plugin-entry keys owned by the ttsc host framework. They are
 * accepted alongside the single lint-specific `configFile` key; every other key
 * is rejected so a stale inline option (`rules`, `format`, `extends`, legacy
 * `config`, `plugins`) surfaces as a clear migration error instead of being
 * silently ignored. Mirrors `@ttsc/banner` and `@ttsc/strip`.
 */
const FRAMEWORK_KEYS = new Set<string>([
  "enabled",
  "name",
  "stage",
  "transform",
]);

/**
 * Plugin descriptor factory consumed by ttsc package discovery.
 *
 * Contributor lint plugins come from one place: the project's lint config file
 * (`lint.config.{ts,cts,mts,js,cjs,mjs,json}` or `ttsc-lint.config.*`). The
 * tsconfig plugin entry carries no rule or plugin surface — it optionally names
 * the config file via `configFile`, otherwise the file is discovered by walking
 * upward from the tsconfig directory (or from the caller-declared
 * `pluginConfigDir` when the resolved tsconfig is a generated wrapper in a temp
 * directory).
 *
 * The factory locates the config file, evaluates it (via ttsx for TS / ESM
 * sources, `require` for CommonJS, `JSON.parse` for JSON), reads every
 * `plugins` map (top-level and inside array-form flat configs), and forwards
 * each contributor's Go source directory to ttsc's plugin builder via the
 * descriptor's `contributors` field.
 */
export default function createTtscPlugin(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): TtscPluginDescriptor {
  rejectUnsupportedEntryKeys(context.plugin);
  const contributors = resolveConfigFileContributors(context);
  // Build the descriptor without a `contributors` key when none were
  // declared, so consumers (and the existing key-shape regression
  // tests) see the same surface as before this feature shipped.
  const descriptor: TtscPluginDescriptor = {
    capabilities: {
      diagnosticsTiming: true,
      lsp: true,
      projectContextArgs: true,
      projectDiagnostics: true,
      projectInputs: true,
      residentCheck: true,
      threadingArgs: true,
    },
    name: "@ttsc/lint",
    reportsTypeScriptDiagnostics: true,
    // `context.dirname` is this descriptor's own directory in every load mode —
    // the ESM-safe replacement for `__dirname`, which is undefined when ttsc
    // loads a descriptor as `.ts` source or ESM.
    source: path.resolve(context.dirname, "..", "plugin"),
    stage: "check",
  };
  if (contributors.length > 0) {
    descriptor.contributors = contributors;
  }
  return descriptor;
}

function loadContributorPluginViaRequire(
  specifier: string,
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
  namespace: string,
  anchorFile?: string,
): ITtscLintPlugin {
  // Resolve relative paths and node_modules lookups from the file that
  // declared the specifier, when one is available — `lint.config.json`
  // / `lint.config.cjs` reach this code with their own path on disk,
  // and ttsc's tsconfig plugin entry falls back to the project root.
  const anchor =
    anchorFile ??
    path.join(
      path.resolve(context.cwd ?? context.projectRoot),
      "__lint_contributor_resolve__.cjs",
    );
  const requireFromProject = createRequire(anchor);
  let resolved: string;
  try {
    resolved = requireFromProject.resolve(specifier);
  } catch (error) {
    throw new Error(
      `@ttsc/lint: failed to resolve contributor "${namespace}" via "${specifier}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  let mod: unknown;
  try {
    mod = requireFromProject(resolved);
  } catch (error) {
    throw new Error(
      `@ttsc/lint: failed to load contributor "${namespace}" from ${resolved}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return validatePluginShape(unwrapDefault(mod), namespace, resolved);
}

// ────────────────────────────────────────────────────────────────────────────
// lint.config.* discovery + evaluation
// ────────────────────────────────────────────────────────────────────────────

/** Plugin entries observed in a lint config file, normalized per file. */
type ConfigPluginEntry = { namespace: string; source: string };

type ConfigDependencyFingerprint = {
  digest: string;
  kind: "directory" | "file" | "optional-file";
  path: string;
  scope: "cache" | "watch";
};

type ConfigPluginEvaluation = {
  dependencies: ConfigDependencyFingerprint[];
  entries: ConfigPluginEntry[];
};

/**
 * Resolves the contributor lint plugins declared in the project's lint config
 * file.
 *
 * - When the tsconfig plugin entry sets `configFile`, that exact file is loaded
 *   (relative paths resolve against the tsconfig directory, or against the
 *   caller-declared `pluginConfigDir` when present).
 * - Otherwise a `lint.config.*` / `ttsc-lint.config.*` file is discovered by
 *   walking upward from the tsconfig directory (or from `pluginConfigDir` when
 *   present).
 *
 * Returns an empty array when no config file is set or discovered — the Go
 * sidecar surfaces the missing-config error; the factory only needs to forward
 * contributors when a config file is present.
 */
function resolveConfigFileContributors(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): TtscPluginContributor[] {
  const configFile = readConfigFileOption(context);
  const configPath =
    configFile !== undefined
      ? path.resolve(pluginConfigBaseDir(context), configFile)
      : findLintConfigFile(context);
  if (!configPath || !fs.existsSync(configPath)) return [];

  const entries = readConfigPluginEntries(configPath, context);
  assertContributorNamespacesDoNotCollide(entries, configPath);
  // Dedup exact repeated namespaces on the Go-subpackage form. Config-array
  // folding can surface the same namespace more than once; that existing
  // behavior stays intact after distinct namespaces are rejected above.
  const occupied = new Set<string>();
  const out: TtscPluginContributor[] = [];
  for (const entry of entries) {
    const goName = goSubpackageName(entry.namespace);
    if (occupied.has(goName)) continue;
    occupied.add(goName);
    out.push({ name: goName, source: entry.source });
  }
  return out;
}

function assertContributorNamespacesDoNotCollide(
  entries: ConfigPluginEntry[],
  configPath: string,
): void {
  const namespacesByGoName = new Map<string, Set<string>>();
  for (const entry of entries) {
    const goName = goSubpackageName(entry.namespace);
    let namespaces = namespacesByGoName.get(goName);
    if (namespaces === undefined) {
      namespaces = new Set<string>();
      namespacesByGoName.set(goName, namespaces);
    }
    namespaces.add(entry.namespace);
  }
  const collisions = [...namespacesByGoName]
    .map(([goName, namespaces]) => [goName, [...namespaces].sort()] as const)
    .filter(([, namespaces]) => namespaces.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
  if (collisions.length === 0) return;

  const details = collisions
    .map(
      ([goName, namespaces]) =>
        `${namespaces.map((namespace) => JSON.stringify(namespace)).join(", ")} all normalize to ${JSON.stringify(goName)}`,
    )
    .join("; ");
  throw new Error(
    `@ttsc/lint: lint config ${configPath} contributor namespaces collide after Go normalization: ${details}`,
  );
}

/**
 * Rejects any tsconfig plugin-entry key that is neither a host framework key
 * nor the single lint-specific `configFile` key. Rule, format, and plugin
 * settings live only in the lint config file, so a leftover inline key is
 * surfaced as an explicit migration error rather than silently ignored.
 */
function rejectUnsupportedEntryKeys(entry: ITtscLintPluginConfig): void {
  for (const key of Object.keys(entry as Record<string, unknown>)) {
    if (FRAMEWORK_KEYS.has(key) || key === "configFile") {
      continue;
    }
    throw new Error(
      `@ttsc/lint: tsconfig plugin entry contains unsupported key ${JSON.stringify(key)}. ` +
        `Rules, format, and plugin settings must live in a ` +
        `lint.config.{ts,cts,mts,js,cjs,mjs,json} file. The only accepted key ` +
        `in the tsconfig entry is "configFile" (optional path to the config file).`,
    );
  }
}

/**
 * Reads the optional `configFile` key from the tsconfig plugin entry. It is the
 * only lint-specific key the entry accepts; when present it overrides
 * auto-discovery of the lint config file.
 */
function readConfigFileOption(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): string | undefined {
  const value = (context.plugin as { configFile?: unknown }).configFile;
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`@ttsc/lint: "configFile" must be a non-empty string path`);
  }
  return value;
}

function findLintConfigFile(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): string | undefined {
  // Mirror the Go side (driver.PluginConfigBaseDir): the caller-declared
  // pluginConfigDir is the single walk origin when present — it names the
  // real project when the resolved tsconfig is a generated wrapper in a temp
  // dir (@ttsc/unplugin's alias overlay), and it keeps the wrapper's temp
  // ancestry out of the walk so a stray config planted there is never
  // honored. Otherwise walk upward from the tsconfig directory first, then
  // fall back to the working directory: that covers callers that point at an
  // out-of-tree tsconfig without declaring an anchor.
  for (const origin of discoveryConfigBaseDirs(context)) {
    const discovered = findLintConfigFileFrom(origin);
    if (discovered !== undefined) {
      return discovered;
    }
  }
  return undefined;
}

function discoveryConfigBaseDirs(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): string[] {
  if (context.pluginConfigDir) {
    return [path.resolve(context.cwd ?? ".", context.pluginConfigDir)];
  }
  const tsconfigDir = tsconfigBaseDir(context);
  const cwd = path.resolve(context.cwd ?? context.projectRoot);
  return tsconfigDir === cwd ? [tsconfigDir] : [tsconfigDir, cwd];
}

function findLintConfigFileFrom(origin: string): string | undefined {
  // Mirror the Go-side discovery loop: walk from `origin` upward, returning
  // the first directory that has exactly one of the candidate filenames.
  // Multiple files in the same directory is treated as ambiguous and skipped
  // (the Go side raises a hard error on the duplicate; here we leave it to
  // the binary's own discovery to surface the issue once with one canonical
  // message).
  const candidateSet = new Set<string>(LINT_CONFIG_FILENAMES);
  let dir = origin;
  while (true) {
    // One `readdirSync` per directory level beats 14 `existsSync`+
    // `statSync` pairs (= 28 stat syscalls) per level; intersect the
    // listing with the candidate set instead.
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      entries = [];
    }
    const matches: string[] = [];
    for (const entry of entries) {
      if (!candidateSet.has(entry.name)) continue;
      if (!entry.isFile() && !entry.isSymbolicLink()) continue;
      matches.push(path.join(dir, entry.name));
    }
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1) {
      return undefined; // ambiguous — defer to the Go side's error
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Base directory for resolving a relative `configFile` from the tsconfig plugin
 * entry. Mirrors the Go side (driver.PluginConfigBaseDir): the caller-declared
 * pluginConfigDir wins when present — the resolved tsconfig is then a generated
 * wrapper in a temp directory that no longer identifies the project — otherwise
 * the tsconfig directory, falling back to the working directory.
 */
function pluginConfigBaseDir(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): string {
  if (context.pluginConfigDir) {
    return path.resolve(context.cwd ?? ".", context.pluginConfigDir);
  }
  return tsconfigBaseDir(context);
}

function tsconfigBaseDir(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): string {
  const cwd = context.cwd ?? context.projectRoot;
  if (context.tsconfig) {
    return path.dirname(
      path.isAbsolute(context.tsconfig)
        ? context.tsconfig
        : path.join(cwd, context.tsconfig),
    );
  }
  return path.resolve(cwd);
}

function readConfigPluginEntries(
  configPath: string,
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): ConfigPluginEntry[] {
  // Every config uses the same isolated evaluator. JSON can name contributor
  // packages whose top-level code writes to stdout, so loading its strings in
  // this host process would corrupt CLI JSON or preface the first LSP frame.
  return readTtsxConfigPlugins(configPath, context);
}

// TypeScript source written to a temp file and executed via ttsx. The
// %CONFIG_IMPORT% placeholder is replaced with a JSON-quoted file URL
// before the file hits disk. The script walks the exported config object,
// collects every `plugins` map, and serialises each plugin's `source` field
// as a JSON array for the parent process to parse — avoiding the need to
// serialise arbitrary in-memory plugin objects across the process boundary.
// The URL lives in a variable so tsgo does not statically resolve it.
/**
 * The descriptor extractor's emitted source.
 *
 * Exported so a regression can inspect the same bytes the loader executes. The
 * template consumes its own escapes, so reading this file's text instead would
 * check characters no consumer ever sees.
 */
export const TTSX_EXTRACTOR_SCRIPT = `// @ts-ignore -- internal loader must not require user-installed Node typings.
import * as fs from "node:fs";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { Buffer } from "node:buffer";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { createHash } from "node:crypto";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { createRequire, registerHooks } from "node:module";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import * as path from "node:path";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { fileURLToPath, pathToFileURL } from "node:url";

const configUrl = %CONFIG_IMPORT%;
const outputPath = %CONFIG_OUTPUT%;
const resolutionRoot = path.resolve(%CONFIG_ROOT%);
const requireFromConfig = createRequire(configUrl);
const CONFIG_KEYS = new Set<string>([
  "files",
  "ignores",
  "extends",
  "plugins",
  "rules",
  "format",
]);
const dependencies = new Map<string, {
  digest: string;
  kind: "directory" | "file" | "optional-file";
  path: string;
  owners: Set<string>;
}>();
const graphNodes = new Map<string, string>();
const graphEdges: Array<{
  child: string;
  packageBoundary: boolean;
  parent: string;
}> = [];
const normalizedConfigUrl = new URL(configUrl).href;
const configLocation = fileURLToPath(normalizedConfigUrl);
graphNodes.set(normalizedConfigUrl, configLocation);
recordDependency(
  "file",
  configLocation,
  createHash("sha256").update(fs.readFileSync(configLocation)).digest("hex"),
  [normalizedConfigUrl],
);
recordPackageManifests(configLocation, [normalizedConfigUrl]);

declare const process: {
  cwd(): string;
  platform: string;
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exit(code?: number): never;
};

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (typeof resolved.url !== "string" || !resolved.url.startsWith("file:")) {
      return resolved;
    }
    const url = new URL(resolved.url).href;
    const parent = context.parentURL && new URL(context.parentURL).href;
    const location = fileURLToPath(url);
    // The entry is recognized by identity, not by string. A module URL is
    // assigned by whoever loaded it, so the config can come back under a
    // different spelling of the same file than the one this process was handed
    // — a Windows short component, or a symlinked ancestor. Comparing strings
    // then rejects the config's own imports at this gate, because their parent
    // is a URL no node was ever recorded under, and the whole dependency graph
    // collapses to the records made before the first import.
    const entry =
      url === new URL(configUrl).href || samePhysicalPath(location, configLocation);
    if (!entry && (parent === undefined || !graphNodes.has(parent))) {
      return resolved;
    }
    graphNodes.set(url, location);
    if (parent !== undefined) {
      graphEdges.push({
        child: url,
        packageBoundary:
          pathHasNodeModules(location) && !isLocalModuleSpecifier(specifier),
        parent,
      });
      recordResolutionTopology(
        specifier,
        parent,
        url,
        location,
        context.conditions,
      );
    }
    try {
      recordDependency(
        "file",
        location,
        createHash("sha256").update(fs.readFileSync(location)).digest("hex"),
        [url],
      );
    } catch {
      // The evaluator remains authoritative for the load error. An unreadable
      // dependency simply makes this result non-cacheable in the parent.
      recordDependency("file", location, "", [url]);
    }
    return resolved;
  },
});

try {
  const importedConfig = configLocation.toLowerCase().endsWith(".json")
    ? JSON.parse(fs.readFileSync(configLocation, "utf8").replace(/^\uFEFF/, ""))
    : await import(configUrl);
  const current = await resolveConfig(importedConfig, true);
  const pluginMaps = collectPluginObjects(current);
  const entries: Array<{ namespace: string; source: string }> = [];
  for (const map of pluginMaps) {
    for (const [namespace, value] of Object.entries(map)) {
      const source = extractPluginSource(value);
      if (source === undefined || source.length === 0) {
        throw new Error(
          \`contributor \${JSON.stringify(namespace)} must resolve to an object with a non-empty "source" string\`,
        );
      }
      entries.push({ namespace, source });
    }
  }
  fs.writeFileSync(outputPath, JSON.stringify({
    dependencies: finalizeDependencies(),
    entries,
  }), "utf8");
} catch (error) {
  process.stderr.write(error instanceof Error && error.stack ? error.stack : String(error));
  process.exit(1);
} finally {
  hooks.deregister();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function recordDependency(
  kind: "directory" | "file" | "optional-file",
  location: string,
  digest: string,
  owners: readonly string[],
): void {
  const key = kind + "\\0" + location;
  const previous = dependencies.get(key);
  const mergedOwners = previous?.owners ?? new Set<string>();
  for (const owner of owners) mergedOwners.add(owner);
  dependencies.set(key, {
    digest: previous !== undefined && previous.digest !== digest ? "" : digest,
    kind,
    owners: mergedOwners,
    path: location,
  });
}

function isLocalModuleSpecifier(specifier: string): boolean {
  return specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:") ||
    /^[A-Za-z]:[\\\\/]/.test(specifier);
}

function pathHasNodeModules(location: string): boolean {
  return location.replaceAll("\\\\", "/").split("/").includes("node_modules");
}

function recordResolutionTopology(
  specifier: string,
  parentUrl: string,
  childUrl: string,
  childLocation: string,
  conditions: readonly string[],
): void {
  const owners = [parentUrl, childUrl];
  const parentLocation = graphNodes.get(parentUrl);
  if (parentLocation !== undefined && isLocalModuleSpecifier(specifier)) {
    recordDirectoryDependency(path.dirname(parentLocation), owners);
  }
  recordDirectoryDependency(path.dirname(childLocation), owners);
  recordPackageManifests(childLocation, owners);
  if (parentLocation !== undefined && !isLocalModuleSpecifier(specifier)) {
    recordNodeModulesSearchDirectories(
      parentLocation,
      specifier,
      childLocation,
      owners,
      conditions,
    );
  }
}

function recordDirectoryDependency(
  location: string,
  owners: readonly string[],
): void {
  try {
    recordDependency("directory", location, directoryDigest(location), owners);
  } catch {
    recordDependency("directory", location, "", owners);
  }
}

function directoryDigest(location: string): string {
  const entries: Buffer[] = [];
  if (process.platform === "win32") {
    for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = Buffer.from(
            fs.readlinkSync(path.join(location, entry.name)),
            "utf8",
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(directoryDigestRecord(Buffer.from(entry.name), entry, target));
    }
  } else {
    for (const entry of fs.readdirSync(location, {
      encoding: "buffer",
      withFileTypes: true,
    })) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = fs.readlinkSync(
            Buffer.concat([
              Buffer.from(location),
              Buffer.from(path.sep),
              entry.name,
            ]),
            { encoding: "buffer" },
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(directoryDigestRecord(entry.name, entry, target));
    }
  }
  entries.sort(Buffer.compare);
  const serialized = Buffer.concat(
    entries.flatMap((entry, index) =>
      index === 0 ? [entry] : [Buffer.from([0]), entry],
    ),
  );
  return createHash("sha256").update(serialized).digest("hex");
}

function directoryDigestRecord(
  name: Buffer,
  entry: {
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  },
  target: Buffer,
): Buffer {
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : entry.isSymbolicLink()
        ? "symlink"
        : "other";
  return Buffer.concat([name, Buffer.from("\\0" + kind + "\\0"), target]);
}

function optionalFileDigest(location: string): string {
  try {
    if (fs.statSync(location).isFile()) {
      return createHash("sha256")
        .update(Buffer.concat([Buffer.from("file\\0"), fs.readFileSync(location)]))
        .digest("hex");
    }
  } catch {
    // Missing, unreadable, and non-file candidates share the absent state.
  }
  return createHash("sha256").update("missing\\0").digest("hex");
}

function recordOptionalFileDependency(
  location: string,
  owners: readonly string[],
): boolean {
  try {
    if (fs.statSync(location).isFile()) {
      recordDependency(
        "file",
        location,
        createHash("sha256").update(fs.readFileSync(location)).digest("hex"),
        owners,
      );
      return true;
    }
  } catch {
    // The exact missing path remains a dependency of the resolution result.
  }
  recordDependency("optional-file", location, optionalFileDigest(location), owners);
  return false;
}

function recordPackageManifests(
  location: string,
  owners: readonly string[],
): void {
  let current = path.dirname(location);
  while (true) {
    const manifest = path.join(current, "package.json");
    if (recordOptionalFileDependency(manifest, owners)) return;
    const parent = path.dirname(current);
    if (parent === current || path.basename(current) === "node_modules") return;
    current = parent;
  }
}

function recordNodeModulesSearchDirectories(
  parentLocation: string,
  specifier: string,
  childLocation: string,
  owners: readonly string[],
  conditions: readonly string[],
): void {
  const packageName = modulePackageName(specifier);
  const scope =
    specifier.startsWith("@") && specifier.includes("/")
      ? specifier.slice(0, specifier.indexOf("/"))
      : undefined;
  let current = path.dirname(parentLocation);
  while (true) {
    // A newly created nearer node_modules directory can shadow the package
    // selected by this evaluation, so missing search levels are dependencies.
    recordDirectoryDependency(current, owners);
    const modules = path.join(current, "node_modules");
    try {
      if (fs.statSync(modules).isDirectory()) {
        recordDirectoryDependency(modules, owners);
        if (scope !== undefined) {
          const scoped = path.join(modules, scope);
          try {
            if (fs.statSync(scoped).isDirectory()) {
              recordDirectoryDependency(scoped, owners);
            }
          } catch {
            // The directory digest of node_modules records a missing scope.
          }
        }
        if (packageName !== undefined) {
          const selected = recordPackageCandidateTopology(
            modules,
            packageName,
            specifier,
            childLocation,
            owners,
            conditions,
          );
          if (
            selected ||
            resolvedPackageContains(modules, packageName, childLocation)
          ) {
            return;
          }
        }
      }
    } catch {
      // Missing search levels do not participate in the current resolution.
    }
    if (
      packageName === undefined &&
      samePhysicalPath(current, resolutionRoot)
    ) {
      return;
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function recordPackageCandidateTopology(
  modules: string,
  packageName: string,
  specifier: string,
  childLocation: string,
  owners: readonly string[],
  conditions: readonly string[],
): boolean {
  const packageRoot = path.join(modules, packageName);
  try {
    if (!fs.statSync(packageRoot).isDirectory()) return false;
  } catch {
    return false;
  }
  const subpath = specifier
    .slice(packageName.length)
    .replace(/^[/\\\\]+/, "");
  const rootTopology = recordPackageRootTopology(
    packageRoot,
    owners,
    subpath === "",
    subpath === "" ? "." : "./" + subpath.replaceAll("\\\\", "/"),
    childLocation,
    conditions,
  );
  if (subpath !== "" && !rootTopology.hasExports) {
    return (
      recordPackageSubpathTopology(
        packageRoot,
        subpath,
        childLocation,
        owners,
      ) || rootTopology.selected
    );
  }
  return rootTopology.selected;
}

function recordPackageRootTopology(
  packageRoot: string,
  owners: readonly string[],
  useMain: boolean,
  packageSubpath: string,
  childLocation: string,
  conditions: readonly string[],
): { hasExports: boolean; selected: boolean } {
  const normalizedRoot = path.resolve(packageRoot);
  const manifest = path.join(normalizedRoot, "package.json");
  const legacySelected = (): boolean =>
    useMain &&
    packagePathCandidateMatchesChild(normalizedRoot, childLocation, true);
  if (!recordOptionalFileDependency(manifest, owners)) {
    const selected = legacySelected();
    if (!selected) {
      recordPackageIndexCandidates(normalizedRoot, useMain, owners);
    }
    return { hasExports: false, selected };
  }
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (value !== null && typeof value === "object") {
      const metadata = value as Record<string, unknown>;
      const hasExports =
        metadata.exports !== undefined && metadata.exports !== null;
      if (hasExports) {
        const target = selectPackageExportsTarget(
          metadata.exports,
          packageSubpath,
          new Set(conditions),
        );
        const candidate =
          typeof target === "string"
            ? packageExportsTarget(normalizedRoot, target)
            : undefined;
        const selected =
          candidate !== undefined &&
          packagePathCandidateMatchesChild(
            candidate,
            childLocation,
            false,
          );
        if (selected) {
          recordPackagePathCandidate(candidate, owners);
        } else if (candidate !== undefined) {
          // A nearer package the search skipped starts winning the moment its
          // own active target appears, and neither the parent node_modules
          // listing nor the manifest changes when only that file is created.
          recordOptionalFileDependency(candidate, owners);
        }
        return { hasExports: true, selected };
      }
      let selected = legacySelected();
      if (useMain && typeof metadata.main === "string") {
        // CommonJS main is a legacy path, not an exports target. Node resolves
        // it literally and permits absolute paths and paths outside the package.
        const main = path.resolve(normalizedRoot, metadata.main);
        recordPackagePathCandidate(main, owners);
        selected =
          packagePathCandidateMatchesChild(main, childLocation, true) ||
          selected;
      }
      if (!selected) {
        recordPackageIndexCandidates(normalizedRoot, useMain, owners);
      }
      return {
        hasExports: false,
        selected,
      };
    }
  } catch {
    // Node owns malformed-manifest diagnostics; the manifest digest is enough
    // to invalidate this evaluation when its contents change.
  }
  const selected = legacySelected();
  if (!selected) {
    recordPackageIndexCandidates(normalizedRoot, useMain, owners);
  }
  return { hasExports: false, selected };
}

// recordPackageIndexCandidates pins the LOAD_INDEX fallbacks of a package root
// this resolution walked past without selecting. An empty package directory, or
// one whose manifest declares no usable entry, becomes resolvable as soon as one
// of these files exists, and that creation changes neither the parent directory
// listing nor the manifest digest already recorded for the candidate.
function recordPackageIndexCandidates(
  packageRoot: string,
  useMain: boolean,
  owners: readonly string[],
): void {
  if (!useMain) return;
  for (const name of ["index.js", "index.json", "index.node"]) {
    recordOptionalFileDependency(path.join(packageRoot, name), owners);
  }
}

function selectPackageExportsTarget(
  exportsValue: unknown,
  packageSubpath: string,
  conditions: ReadonlySet<string>,
): string | null | undefined {
  let mappings: unknown = exportsValue;
  if (
    typeof mappings === "string" ||
    Array.isArray(mappings) ||
    (isObject(mappings) &&
      Object.keys(mappings).every((key) => !key.startsWith(".")))
  ) {
    if (packageSubpath !== ".") return undefined;
    return selectPackageTarget(mappings, "", false, conditions);
  }
  if (!isObject(mappings)) return undefined;
  if (
    Object.prototype.hasOwnProperty.call(mappings, packageSubpath) &&
    !packageSubpath.includes("*") &&
    !packageSubpath.endsWith("/")
  ) {
    return selectPackageTarget(
      mappings[packageSubpath],
      "",
      false,
      conditions,
    );
  }
  let bestMatch = "";
  let bestSubpath = "";
  for (const key of Object.keys(mappings)) {
    const wildcard = key.indexOf("*");
    if (
      wildcard === -1 ||
      key.lastIndexOf("*") !== wildcard ||
      !packageSubpath.startsWith(key.slice(0, wildcard))
    ) {
      continue;
    }
    const trailer = key.slice(wildcard + 1);
    if (
      packageSubpath.length < key.length ||
      !packageSubpath.endsWith(trailer) ||
      packagePatternKeyCompare(bestMatch, key) !== 1
    ) {
      continue;
    }
    bestMatch = key;
    bestSubpath = packageSubpath.slice(
      wildcard,
      packageSubpath.length - trailer.length,
    );
  }
  return bestMatch === ""
    ? undefined
    : selectPackageTarget(
        mappings[bestMatch],
        bestSubpath,
        true,
        conditions,
      );
}

function selectPackageTarget(
  target: unknown,
  subpath: string,
  pattern: boolean,
  conditions: ReadonlySet<string>,
): string | null | undefined {
  if (typeof target === "string") {
    const selected = pattern ? target.replaceAll("*", subpath) : target;
    return validPackageExportsTarget(selected) ? selected : undefined;
  }
  if (Array.isArray(target)) {
    for (const item of target) {
      const selected = selectPackageTarget(
        item,
        subpath,
        pattern,
        conditions,
      );
      if (selected !== undefined && selected !== null) return selected;
    }
    return null;
  }
  if (isObject(target)) {
    for (const [condition, value] of Object.entries(target)) {
      if (condition !== "default" && !conditions.has(condition)) continue;
      const selected = selectPackageTarget(
        value,
        subpath,
        pattern,
        conditions,
      );
      if (selected !== undefined) return selected;
    }
    return undefined;
  }
  return target === null ? null : undefined;
}

function packagePatternKeyCompare(left: string, right: string): number {
  const leftWildcard = left.indexOf("*");
  const rightWildcard = right.indexOf("*");
  const leftBase =
    leftWildcard === -1 ? left.length : leftWildcard + 1;
  const rightBase =
    rightWildcard === -1 ? right.length : rightWildcard + 1;
  if (leftBase > rightBase) return -1;
  if (rightBase > leftBase) return 1;
  if (leftWildcard === -1) return 1;
  if (rightWildcard === -1) return -1;
  if (left.length > right.length) return -1;
  if (right.length > left.length) return 1;
  return 0;
}

function packageExportsTarget(
  packageRoot: string,
  target: string,
): string | undefined {
  if (!validPackageExportsTarget(target)) return undefined;
  try {
    // Node resolves an exports target as a URL against the package manifest,
    // so percent escapes, query strings, and fragments all take part in the
    // path it finally loads. Joining the raw target by hand diverges from that
    // whenever the target is anything but a plain relative path, and a target
    // Node resolves while this model rejects loses the selected file's
    // fingerprint, leaving a retargeted symlink cached as fresh.
    const packageUrl = pathToFileURL(path.join(packageRoot, "package.json"));
    const resolved = new URL(target, packageUrl);
    const packagePath = new URL(".", packageUrl).pathname;
    if (!resolved.pathname.startsWith(packagePath)) return undefined;
    return fileURLToPath(resolved);
  } catch {
    return undefined;
  }
}

function validPackageExportsTarget(target: string): boolean {
  if (!target.startsWith("./") || /%2f|%5c/i.test(target)) return false;
  const components = target
    .slice(2)
    .replaceAll("\\\\", "/")
    .split("/");
  if (
    components.some(
      (component) => {
        try {
          const decoded = decodeURIComponent(component);
          return (
            decoded === "." ||
            decoded === ".." ||
            decoded.includes("/") ||
            decoded.includes("\\\\") ||
            decoded.toLowerCase() === "node_modules"
          );
        } catch {
          return true;
        }
      },
    )
  ) {
    return false;
  }
  return true;
}

function packagePathCandidateMatchesChild(
  candidate: string,
  childLocation: string,
  legacy: boolean,
): boolean {
  let child: string;
  try {
    child = fs.realpathSync.native(childLocation);
  } catch {
    child = path.resolve(childLocation);
  }
  const candidates = legacy
    ? [
        candidate,
        candidate + ".js",
        candidate + ".json",
        candidate + ".node",
        path.join(candidate, "index.js"),
        path.join(candidate, "index.json"),
        path.join(candidate, "index.node"),
      ]
    : [candidate];
  return candidates.some((location) => {
    try {
      return sameResolutionPath(fs.realpathSync.native(location), child);
    } catch {
      return false;
    }
  });
}

function recordPackageSubpathTopology(
  packageRoot: string,
  subpath: string,
  childLocation: string,
  owners: readonly string[],
): boolean {
  const candidate = boundedPackageTarget(packageRoot, subpath);
  if (candidate === undefined) return false;
  recordPackagePathCandidate(candidate, owners);
  let selected = packagePathCandidateMatchesChild(
    candidate,
    childLocation,
    true,
  );
  try {
    if (!fs.statSync(candidate).isDirectory()) return selected;
  } catch {
    return selected;
  }
  const manifest = path.join(candidate, "package.json");
  if (!recordOptionalFileDependency(manifest, owners)) return selected;
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (value !== null && typeof value === "object") {
      const metadata = value as Record<string, unknown>;
      if (typeof metadata.main === "string") {
        const main = path.resolve(candidate, metadata.main);
        recordPackagePathCandidate(main, owners);
        selected =
          packagePathCandidateMatchesChild(main, childLocation, true) ||
          selected;
      }
    }
  } catch {
    // Node owns malformed nested-package diagnostics.
  }
  return selected;
}

function boundedPackageTarget(
  packageRoot: string,
  target: string,
): string | undefined {
  const candidate = path.resolve(packageRoot, target);
  const relative = path.relative(packageRoot, candidate);
  if (
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return candidate;
}

function recordPackagePathCandidate(
  candidate: string,
  owners: readonly string[],
  visited: Set<string> = new Set(),
  depth = 0,
): void {
  const normalized = path.resolve(candidate);
  // The depth bound owns termination. A platform-wide case fold would merge
  // paths that differ only by case, which a per-directory case-sensitive
  // Windows tree keeps distinct, and would truncate a valid symlink chain.
  if (depth >= 64 || visited.has(normalized)) return;
  visited.add(normalized);
  const parsed = path.parse(normalized);
  const components = normalized
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  let current = parsed.root;
  for (let index = 0; index < components.length; index++) {
    const component = components[index];
    const next = path.join(current, component);
    let entry: ReturnType<typeof fs.lstatSync>;
    try {
      entry = fs.lstatSync(next);
    } catch {
      recordDirectoryDependency(current, owners);
      return;
    }
    if (entry.isSymbolicLink()) {
      // The containing directory digest carries the raw link target.
      recordDirectoryDependency(current, owners);
      try {
        const target = fs.readlinkSync(next);
        const remainder = components.slice(index + 1);
        recordPackagePathCandidate(
          path.join(
            path.resolve(current, target),
            ...remainder,
          ),
          owners,
          visited,
          depth + 1,
        );
      } catch {
        // The lexical link record already carries the unreadable state.
      }
    }
    let isDirectory = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        isDirectory = fs.statSync(next).isDirectory();
      } catch {
        return;
      }
    }
    if (index === components.length - 1) {
      recordDirectoryDependency(isDirectory ? next : current, owners);
      return;
    }
    if (!isDirectory) {
      recordDirectoryDependency(current, owners);
      return;
    }
    current = next;
  }
  recordDirectoryDependency(current, owners);
}

function modulePackageName(specifier: string): string | undefined {
  if (specifier.startsWith("@")) {
    const components = specifier.split("/");
    return components.length >= 2
      ? components[0] + "/" + components[1]
      : undefined;
  }
  const [name] = specifier.split("/");
  return name && !name.startsWith("#") ? name : undefined;
}

function resolvedPackageContains(
  modules: string,
  packageName: string,
  childLocation: string,
): boolean {
  try {
    const packageRoot = fs.realpathSync(path.join(modules, packageName));
    const relative = path.relative(
      packageRoot,
      fs.realpathSync(childLocation),
    );
    return (
      relative === "" ||
      (relative !== ".." &&
        !relative.startsWith(".." + path.sep) &&
        !path.isAbsolute(relative))
    );
  } catch {
    return false;
  }
}

function sameResolutionPath(left: string, right: string): boolean {
  return path.relative(left, right) === "";
}

function samePhysicalPath(left: string, right: string): boolean {
  try {
    return sameResolutionPath(realPath(left), realPath(right));
  } catch {
    // Fall back to the spellings themselves, folding case the way the platform
    // does. On the entry gate a false negative is catastrophic — the config
    // stops being recognized and its whole graph collapses — while a false
    // positive only over-includes, so the degradation has to lean toward "same
    // file". A drive-letter or component case difference is the ordinary
    // Windows situation; a per-directory case-sensitive tree is the rare one.
    return sameResolutionPath(left, right);
  }
}

function realPath(location: string): string {
  return fs.realpathSync.native
    ? fs.realpathSync.native(location)
    : fs.realpathSync(location);
}

function finalizeDependencies(): Array<{
  digest: string;
  kind: "directory" | "file" | "optional-file";
  path: string;
  scope: "cache" | "watch";
}> {
  const watched = graphWatchReachability();
  return [...dependencies.values()].map(({ owners, ...dependency }) => ({
    ...dependency,
    scope: [...owners].some((owner) => watched.has(owner))
      ? "watch"
      : "cache",
  }));
}

function graphWatchReachability(): Set<string> {
  const config = new URL(configUrl).href;
  const adjacency = new Map<string, typeof graphEdges>();
  for (const edge of graphEdges) {
    const outgoing = adjacency.get(edge.parent) ?? [];
    outgoing.push(edge);
    adjacency.set(edge.parent, outgoing);
  }
  const queue: Array<{ url: string; watched: boolean }> = [
    { url: config, watched: true },
  ];
  const visited = new Set<string>();
  const watched = new Set<string>();
  while (queue.length !== 0) {
    const state = queue.shift()!;
    const key = state.url + "\\0" + (state.watched ? "1" : "0");
    if (visited.has(key)) continue;
    visited.add(key);
    if (state.watched) watched.add(state.url);
    for (const edge of adjacency.get(state.url) ?? []) {
      const childLocation = graphNodes.get(edge.child);
      const childWatched = edge.packageBoundary
        ? false
        : childLocation !== undefined && !pathHasNodeModules(childLocation)
          ? true
          : state.watched;
      queue.push({ url: edge.child, watched: childWatched });
    }
  }
  return watched;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

async function resolveConfig(value: unknown, allowNamedConfig: boolean): Promise<unknown> {
  let current = value;
  for (let i = 0; i < 8; i++) {
    if (typeof current === "function") {
      current = await (current as () => unknown | Promise<unknown>)();
      allowNamedConfig = false;
      continue;
    }
    if (isObject(current) && !Array.isArray(current)) {
      if (hasOwn(current, "default")) {
        const defaultValue = current.default;
        if (isModuleNamespace(current) || !hasConfigKey(current)) {
          current = defaultValue;
          allowNamedConfig = false;
          continue;
        }
        const normalizedDefault = await resolveConfig(defaultValue, false);
        if (isObject(normalizedDefault) && !Array.isArray(normalizedDefault)) {
          current = mergeConfigObjects(normalizedDefault, current);
          allowNamedConfig = false;
          continue;
        }
      }
      if (allowNamedConfig && hasOwn(current, "config")) {
        current = current.config;
        allowNamedConfig = false;
        continue;
      }
    }
    break;
  }
  return current;
}

function isModuleNamespace(value: Record<string, unknown>): boolean {
  return Object.prototype.toString.call(value) === "[object Module]";
}

function hasConfigKey(value: Record<string, unknown>): boolean {
  for (const key of CONFIG_KEYS) {
    if (hasOwn(value, key)) {
      return true;
    }
  }
  return false;
}

function mergeConfigObjects(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CONFIG_KEYS) {
    if (hasOwn(base, key)) {
      out[key] = base[key];
    }
  }
  for (const key of CONFIG_KEYS) {
    if (hasOwn(override, key)) {
      out[key] = override[key];
    }
  }
  return out;
}

function collectPluginObjects(value: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  visit(value);
  return out;

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isObject(node)) return;
    if (hasOwn(node, "plugins") && isObject(node.plugins)) {
      out.push(node.plugins as Record<string, unknown>);
    }
  }
}

function extractPluginSource(value: unknown): string | undefined {
  if (typeof value === "string") {
    value = requireFromConfig(value);
  }
  if (!isObject(value)) return undefined;
  // ESM-from-CJS interop wraps CJS modules' \`exports.default\` so the
  // plugin object can land under a \`.default\` indirection. Walk a few
  // hops so contributors authored as \`export default plugin\` and
  // contributors authored as plain \`module.exports = plugin\` both
  // resolve identically.
  let current: Record<string, unknown> = value;
  // 8 hops to match the outer-process unwrapDefault helper; previously
  // 4, which silently misrouted deeply re-exported plugins while
  // unwrapDefault would have unwrapped them.
  for (let i = 0; i < 8; i++) {
    if (typeof current.source === "string") break;
    const next = current.default;
    if (!isObject(next)) break;
    current = next;
  }
  const source = current.source;
  return typeof source === "string" ? source : undefined;
}
`;

/**
 * Resolves contributor plugin entries declared in any executable lint config,
 * memoized through the shared on-disk config cache.
 *
 * Evaluating such a config spawns a full `ttsx` subprocess. A monorepo build
 * runs one `ttsc` process per package, and each would otherwise re-spawn `ttsx`
 * for the same shared config; the cache collapses that to a single evaluation.
 * The cache key covers the entry's path and exact contents; the payload also
 * fingerprints every local module reached from that entry. An entry or helper
 * edit therefore re-evaluates cleanly without treating installed packages as
 * project watch inputs.
 */
function readTtsxConfigPlugins(
  configPath: string,
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): ConfigPluginEntry[] {
  const resolutionRoot = path.resolve(pluginConfigBaseDir(context));
  const cacheKey = configCacheKey(`plugins\0${resolutionRoot}`, configPath);
  if (cacheKey) {
    const cached = readConfigPluginCache(cacheKey);
    // Re-validate cached entries before trusting them: a contributor's
    // resolved `source` directory may have moved since the entry was
    // written. A stale entry falls through to a fresh evaluation rather
    // than being forwarded to ttsc's plugin builder as a dead path.
    if (
      cached &&
      cached.entries.every(isValidConfigPluginEntry) &&
      configDependenciesAreCurrent(cached.dependencies)
    ) {
      return cached.entries;
    }
  }
  // A config can be saved while it is being evaluated. Retry a bounded number
  // of times until every dependency still has the bytes the module hook saw.
  // A continuously changing config remains usable but is deliberately not
  // cached; watch will schedule another cycle.
  let evaluation: ConfigPluginEvaluation;
  for (let attempt = 0; attempt < 3; attempt++) {
    evaluation = evaluateTtsxConfigPlugins(configPath, context);
    if (configDependenciesAreCurrent(evaluation.dependencies)) {
      if (cacheKey) writeConfigPluginCache(cacheKey, evaluation);
      return evaluation.entries;
    }
  }
  return evaluation!.entries;
}

/**
 * Reports whether a cached plugin entry is still usable: a well-formed
 * namespace and an absolute `source` that still points at a directory. Pure
 * predicate — never throws — so a malformed cache entry simply triggers
 * re-evaluation instead of aborting plugin discovery.
 */
function isValidConfigPluginEntry(entry: unknown): entry is ConfigPluginEntry {
  if (
    entry == null ||
    typeof entry !== "object" ||
    typeof (entry as ConfigPluginEntry).namespace !== "string" ||
    typeof (entry as ConfigPluginEntry).source !== "string"
  ) {
    return false;
  }
  const { namespace, source } = entry as ConfigPluginEntry;
  if (!NAMESPACE_PATTERN.test(namespace) || !path.isAbsolute(source)) {
    return false;
  }
  try {
    return fs.statSync(source).isDirectory();
  } catch {
    return false;
  }
}

function evaluateTtsxConfigPlugins(
  configPath: string,
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): ConfigPluginEvaluation {
  const tempDir = realpathIfPossible(
    fs.mkdtempSync(path.join(loaderTempBase(configPath), "ttsc-lint-cfg-")),
  );
  try {
    linkNearestNodeModules(tempDir, path.dirname(configPath));
    const loaderPath = path.join(tempDir, "loader.mts");
    const outputPath = path.join(tempDir, "result.json");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const loaderSource = TTSX_EXTRACTOR_SCRIPT.replace(
      "%CONFIG_IMPORT%",
      JSON.stringify(pathToFileURL(configPath).href),
    )
      .replace("%CONFIG_OUTPUT%", JSON.stringify(outputPath))
      .replace(
        "%CONFIG_ROOT%",
        JSON.stringify(path.resolve(pluginConfigBaseDir(context))),
      );
    fs.writeFileSync(loaderPath, loaderSource, "utf8");
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            // `.mjs` and `.js` configs reach this loader because Node
            // cannot `require()` ESM synchronously; ttsx's TypeScript
            // project compiler refuses to admit them without `allowJs`,
            // so set it alongside the strict bypass to make the loader
            // tolerant of any of `lint.config.{ts,cts,mts,js,mjs,cjs}`.
            allowImportingTsExtensions: true,
            allowJs: true,
            checkJs: false,
            module: "ESNext",
            moduleResolution: "bundler",
            noImplicitAny: false,
            outDir: path.join(tempDir, "out").replace(/\\/g, "/"),
            rewriteRelativeImportExtensions: true,
            rootDir: path.parse(tempDir).root.replace(/\\/g, "/"),
            skipLibCheck: true,
            strict: false,
            target: "ES2022",
          },
          files: [
            loaderPath.replace(/\\/g, "/"),
            ...(path.extname(configPath).toLowerCase() === ".json"
              ? []
              : [configPath.replace(/\\/g, "/")]),
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const ttsxBinary = process.env.TTSC_TTSX_BINARY ?? "ttsx";
    // `--no-plugins` keeps this build hermetic: the loader only needs to
    // type-check and run the user's lint config to extract its plugin
    // entries. Loading the host project's transform/check plugins
    // (`@nestia/core`, `typia`, …) would run their project checks
    // against this deliberately lenient loader tsconfig and fail the
    // build — e.g. `@nestia/core` rejects the loader's `strict: false`.
    const args = [
      "--project",
      tsconfigPath,
      "--cwd",
      tempDir,
      "--no-plugins",
      loaderPath,
    ];
    if (process.env.TTSC_TSGO_BINARY) {
      args.unshift("--binary", process.env.TTSC_TSGO_BINARY);
    }
    const env = nodeConfigLoaderEnv(configPath);
    const command = ttsxThroughNodeIfNeeded(ttsxBinary);
    const result = spawnSync(command.binary, [...command.prefix, ...args], {
      cwd: tempDir,
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 16,
      stdio: ["ignore", "pipe", "pipe"],
      // 60s cap so a runaway top-level await / infinite loop in the
      // user's lint config can't hang the entire ttsc invocation.
      timeout: 60_000,
      windowsHide: true,
    });
    forwardConfigEvaluatorStreams(result.stdout, result.stderr);
    if (result.error) {
      throw new Error(
        `@ttsc/lint: failed to spawn ttsx for ${configPath}: ${result.error.message}`,
      );
    }
    if (result.signal) {
      throw new Error(
        `@ttsc/lint: ttsx evaluation of ${configPath} was killed by signal ${result.signal} ` +
          `(likely the 60s timeout). Simplify the config or move heavy work out of top-level.`,
      );
    }
    if (result.status !== 0) {
      throw new Error(
        `@ttsc/lint: lint config ${configPath} evaluation failed with exit code ${String(result.status)}`,
      );
    }
    let payload: {
      dependencies?: ConfigDependencyFingerprint[];
      entries?: ConfigPluginEntry[];
    };
    try {
      payload = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
        dependencies?: ConfigDependencyFingerprint[];
        entries?: ConfigPluginEntry[];
      };
    } catch (error) {
      throw new Error(
        `@ttsc/lint: lint config ${configPath} evaluator returned invalid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (!Array.isArray(payload.entries)) {
      throw new Error(
        `@ttsc/lint: lint config ${configPath} evaluator omitted its plugin-entry array`,
      );
    }
    const entries = payload.entries.map((entry) => {
      // The ttsx extractor already resolved each plugin object's
      // `source` to an absolute directory path. Validate the shape but
      // skip the specifier-resolution branch — re-routing a directory
      // through `createRequire().resolve` would fail.
      if (
        entry === null ||
        typeof entry !== "object" ||
        typeof entry.namespace !== "string"
      ) {
        throw new Error(
          `@ttsc/lint: lint config ${configPath} evaluator returned a malformed plugin entry`,
        );
      }
      if (!NAMESPACE_PATTERN.test(entry.namespace)) {
        throw new Error(
          `@ttsc/lint: lint config ${configPath} namespace ${JSON.stringify(entry.namespace)} must match /^[a-z][a-z0-9_-]*$/`,
        );
      }
      if (typeof entry.source !== "string" || entry.source.length === 0) {
        throw new Error(
          `@ttsc/lint: lint config ${configPath} plugin ${JSON.stringify(entry.namespace)} did not expose a "source" string`,
        );
      }
      if (!path.isAbsolute(entry.source)) {
        throw new Error(
          `@ttsc/lint: lint config ${configPath} plugin ${JSON.stringify(entry.namespace)} "source" must be absolute; got ${JSON.stringify(entry.source)}`,
        );
      }
      if (
        !fs.existsSync(entry.source) ||
        !fs.statSync(entry.source).isDirectory()
      ) {
        throw new Error(
          `@ttsc/lint: lint config ${configPath} plugin ${JSON.stringify(entry.namespace)} "source" must be an existing directory: ${entry.source}`,
        );
      }
      return { namespace: entry.namespace, source: entry.source };
    });
    const dependencies = normalizeConfigDependencyFingerprints(
      payload.dependencies,
    );
    if (dependencies === undefined) {
      throw new Error(
        `@ttsc/lint: lint config ${configPath} evaluator returned malformed dependency fingerprints`,
      );
    }
    return { dependencies, entries };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function forwardConfigEvaluatorStreams(
  stdout: string | null | undefined,
  stderr: string | null | undefined,
): void {
  // Both child streams are human output. Parent stdout is reserved for compiler
  // JSON or LSP frames, so even a user console.log is redirected.
  if (stdout) process.stderr.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

// ────────────────────────────────────────────────────────────────────────────
// Config cache (shared with the Go sidecar — packages/lint/linthost/config.go)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Namespaces the on-disk config cache. Kept in lockstep with the Go sidecar's
 * `configCacheVersion`; bump both when the cached shape changes.
 */
const CONFIG_CACHE_VERSION = "v5";

/**
 * Directory shared by this factory and the Go sidecar for cached lint configs.
 * The two write different files (the `kind` segment of the cache key keeps
 * their namespaces apart), so they coexist without collision.
 */
function configCacheDir(): string {
  return path.join(os.tmpdir(), "ttsc-lint-config-cache");
}

/** Env opt-out, mirroring the Go sidecar's `TTSC_LINT_DISABLE_CONFIG_CACHE`. */
function configCacheDisabled(): boolean {
  return Boolean(process.env.TTSC_LINT_DISABLE_CONFIG_CACHE);
}

/**
 * Content-addressed cache key for a lint config file. Mirrors the Go sidecar's
 * `configCacheKey`: a version tag, a namespace `kind`, the config's absolute
 * path, and its exact bytes. Returns "" — a "do not cache" signal — when the
 * file cannot be read or the env opt-out is set.
 */
function configCacheKey(kind: string, configPath: string): string {
  if (configCacheDisabled()) return "";
  let content: Buffer;
  try {
    content = fs.readFileSync(configPath);
  } catch {
    return "";
  }
  return createHash("sha256")
    .update(CONFIG_CACHE_VERSION)
    .update("\0")
    .update(kind)
    .update("\0")
    .update(path.resolve(configPath))
    .update("\0")
    .update(content)
    .digest("hex");
}

/**
 * Returns the cached plugin-entry list for `cacheKey`, or undefined on any miss
 * — a missing file, an unreadable file, or content that is not a JSON array.
 * Every failure is a soft miss: the caller re-evaluates.
 */
function readConfigPluginCache(
  cacheKey: string,
): ConfigPluginEvaluation | undefined {
  let body: string;
  try {
    body = fs.readFileSync(
      path.join(configCacheDir(), `${cacheKey}.json`),
      "utf8",
    );
  } catch {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as ConfigPluginEvaluation).entries) ||
      !Array.isArray((parsed as ConfigPluginEvaluation).dependencies)
    ) {
      return undefined;
    }
    const dependencies = normalizeConfigDependencyFingerprints(
      (parsed as ConfigPluginEvaluation).dependencies,
    );
    if (dependencies === undefined) return undefined;
    return {
      dependencies,
      entries: (parsed as ConfigPluginEvaluation).entries,
    };
  } catch {
    return undefined;
  }
}

/**
 * Writes `entries` to the config cache under `cacheKey`. Best-effort: any
 * failure leaves the cache cold rather than aborting plugin discovery. The
 * temp-file + rename keeps a concurrent reader in a sibling `ttsc` process from
 * observing a half-written file.
 */
function writeConfigPluginCache(
  cacheKey: string,
  evaluation: ConfigPluginEvaluation,
): void {
  try {
    const dir = configCacheDir();
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(
      dir,
      `${cacheKey}.${process.pid}.${randomUUID()}.tmp`,
    );
    try {
      fs.writeFileSync(tmp, JSON.stringify(evaluation), "utf8");
      fs.renameSync(tmp, path.join(dir, `${cacheKey}.json`));
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        // A successful rename already consumed the temporary path.
      }
    }
  } catch {
    // Cold cache on failure — the next invocation re-evaluates.
  }
}

function normalizeConfigDependencyFingerprints(
  value: unknown,
): ConfigDependencyFingerprint[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const dependencies = new Map<string, ConfigDependencyFingerprint>();
  for (const candidate of value) {
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      typeof (candidate as ConfigDependencyFingerprint).path !== "string" ||
      typeof (candidate as ConfigDependencyFingerprint).digest !== "string" ||
      !["directory", "file", "optional-file"].includes(
        (candidate as ConfigDependencyFingerprint).kind,
      ) ||
      !["cache", "watch"].includes(
        (candidate as ConfigDependencyFingerprint).scope,
      )
    ) {
      return undefined;
    }
    const candidatePath = (candidate as ConfigDependencyFingerprint).path;
    const digest = (candidate as ConfigDependencyFingerprint).digest;
    const kind = (candidate as ConfigDependencyFingerprint).kind;
    const scope = (candidate as ConfigDependencyFingerprint).scope;
    if (!path.isAbsolute(candidatePath) || !/^[0-9a-f]{64}$/.test(digest)) {
      return undefined;
    }
    const location = path.resolve(candidatePath);
    const previous = dependencies.get(location);
    if (
      previous !== undefined &&
      (previous.digest !== digest ||
        previous.kind !== kind ||
        previous.scope !== scope)
    ) {
      return undefined;
    }
    dependencies.set(location, {
      digest,
      kind,
      path: location,
      scope,
    });
  }
  return [...dependencies.values()].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

function configDependenciesAreCurrent(
  dependencies: readonly ConfigDependencyFingerprint[],
): boolean {
  if (dependencies.length === 0) return false;
  return dependencies.every((dependency) => {
    if (!/^[0-9a-f]{64}$/.test(dependency.digest)) return false;
    try {
      const digest =
        dependency.kind === "directory"
          ? configDirectoryDigest(dependency.path)
          : dependency.kind === "optional-file"
            ? configOptionalFileDigest(dependency.path)
            : createHash("sha256")
                .update(fs.readFileSync(dependency.path))
                .digest("hex");
      return digest === dependency.digest;
    } catch {
      return false;
    }
  });
}

function configDirectoryDigest(location: string): string {
  const entries: Buffer[] = [];
  if (process.platform === "win32") {
    for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = Buffer.from(
            fs.readlinkSync(path.join(location, entry.name)),
            "utf8",
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(
        configDirectoryDigestRecord(Buffer.from(entry.name), entry, target),
      );
    }
  } else {
    for (const entry of fs.readdirSync(location, {
      encoding: "buffer",
      withFileTypes: true,
    })) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = fs.readlinkSync(
            Buffer.concat([
              Buffer.from(location),
              Buffer.from(path.sep),
              entry.name,
            ]),
            { encoding: "buffer" },
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(configDirectoryDigestRecord(entry.name, entry, target));
    }
  }
  entries.sort(Buffer.compare);
  const serialized = Buffer.concat(
    entries.flatMap((entry, index) =>
      index === 0 ? [entry] : [Buffer.from([0]), entry],
    ),
  );
  return createHash("sha256").update(serialized).digest("hex");
}

function configDirectoryDigestRecord(
  name: Buffer,
  entry: {
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  },
  target: Buffer,
): Buffer {
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : entry.isSymbolicLink()
        ? "symlink"
        : "other";
  return Buffer.concat([name, Buffer.from("\0" + kind + "\0"), target]);
}

function configOptionalFileDigest(location: string): string {
  try {
    if (fs.statSync(location).isFile()) {
      return createHash("sha256")
        .update(
          Buffer.concat([Buffer.from("file\0"), fs.readFileSync(location)]),
        )
        .digest("hex");
    }
  } catch {
    // Missing, unreadable, and non-file candidates share the absent state.
  }
  return createHash("sha256").update("missing\0").digest("hex");
}

// ────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────────────────────────

function collectPluginObjectsFromConfig(
  value: unknown,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const obj = node as Record<string, unknown>;
    const plugins = obj.plugins;
    if (
      typeof plugins === "object" &&
      plugins !== null &&
      !Array.isArray(plugins)
    ) {
      out.push(plugins as Record<string, unknown>);
    }
  };
  visit(value);
  return out;
}

function normalizePluginValue(
  namespace: string,
  value: unknown,
  configPath: string,
): ConfigPluginEntry {
  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(
      `@ttsc/lint: lint config ${configPath} namespace ${JSON.stringify(namespace)} must match /^[a-z][a-z0-9_-]*$/`,
    );
  }
  if (typeof value === "string") {
    // For .js/.cjs configs, a string value would be an npm specifier
    // (matching JSON behavior). require it through the config's own
    // module resolution.
    const requireFromConfig = createRequire(configPath);
    let resolved: string;
    try {
      resolved = requireFromConfig.resolve(value);
    } catch (error) {
      throw new Error(
        `@ttsc/lint: lint config ${configPath} plugin ${JSON.stringify(namespace)} failed to resolve "${value}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    let mod: unknown;
    try {
      mod = requireFromConfig(resolved);
    } catch (error) {
      throw new Error(
        `@ttsc/lint: lint config ${configPath} plugin ${JSON.stringify(namespace)} failed to load from ${resolved}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const plugin = validatePluginShape(unwrapDefault(mod), namespace, resolved);
    return { namespace, source: plugin.source };
  }
  if (typeof value === "object" && value !== null) {
    const plugin = validatePluginShape(value, namespace, configPath);
    return { namespace, source: plugin.source };
  }
  throw new Error(
    `@ttsc/lint: lint config ${configPath} plugin ${JSON.stringify(namespace)} must be a plugin object or specifier string; got ${typeof value}`,
  );
}

function validatePluginShape(
  candidate: unknown,
  namespace: string,
  origin: string,
): ITtscLintPlugin {
  if (typeof candidate !== "object" || candidate === null) {
    throw new Error(
      `@ttsc/lint: contributor "${namespace}" loaded from ${origin} did not export an object`,
    );
  }
  const obj = candidate as Record<string, unknown>;
  if (typeof obj.source !== "string" || obj.source.length === 0) {
    throw new Error(
      `@ttsc/lint: contributor "${namespace}" from ${origin} is missing a string "source" field`,
    );
  }
  if (!path.isAbsolute(obj.source)) {
    throw new Error(
      `@ttsc/lint: contributor "${namespace}" from ${origin} "source" must be an absolute path; got ${JSON.stringify(obj.source)}. Use path.resolve(__dirname, ...).`,
    );
  }
  if (!fs.existsSync(obj.source) || !fs.statSync(obj.source).isDirectory()) {
    throw new Error(
      `@ttsc/lint: contributor "${namespace}" from ${origin} "source" must be an existing directory: ${obj.source}`,
    );
  }
  return obj as unknown as ITtscLintPlugin;
}

function unwrapDefault(mod: unknown): unknown {
  let current: unknown = mod;
  for (let i = 0; i < 8; i++) {
    if (
      current !== null &&
      typeof current === "object" &&
      "default" in current
    ) {
      const next = (current as Record<string, unknown>).default;
      if (next !== undefined) {
        current = next;
        continue;
      }
    }
    break;
  }
  return current;
}

function findNearestNodeModules(start: string): string | undefined {
  let dir = path.resolve(start);
  while (true) {
    const candidate = path.join(dir, "node_modules");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function linkNearestNodeModules(tempDir: string, sourceDir: string): void {
  const nodeModules = findNearestNodeModules(sourceDir);
  if (!nodeModules) return;
  const link = path.join(tempDir, "node_modules");
  try {
    fs.symlinkSync(nodeModules, link, "junction");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") {
      throw new Error(
        `@ttsc/lint: failed to link node_modules from ${nodeModules}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

/**
 * Picks the parent directory for the ephemeral config-loader tree. The system
 * temp dir is the default, but when it sits on a different volume than the
 * config file (Windows: TEMP on `C:`, project on `D:`) the loader cannot work
 * from there — no single tsconfig `rootDir` spans two volumes and
 * `path.relative` cannot produce a relative import across drives (#305) — so
 * the tree is created under the config's nearest `node_modules/.cache` instead,
 * falling back to the config's own directory when no `node_modules` exists (or
 * its `.cache` cannot be created): any location on the config's volume beats
 * the system temp dir, which is guaranteed to fail. Keeps the system temp dir
 * when the volumes already match.
 */
function loaderTempBase(configPath: string): string {
  const systemTemp = os.tmpdir();
  const systemRoot = path.parse(systemTemp).root;
  const configRoot = path.parse(configPath).root;
  // A relative config path has no root; "" must not be read as "a volume
  // other than the system temp's" — it keeps the historical default.
  if (
    configRoot === "" ||
    systemRoot.toLowerCase() === configRoot.toLowerCase()
  ) {
    return systemTemp;
  }
  const nodeModules = findNearestNodeModules(path.dirname(configPath));
  if (!nodeModules) return path.dirname(configPath);
  const base = path.join(nodeModules, ".cache");
  try {
    fs.mkdirSync(base, { recursive: true });
    // Resolve symlinks/junctions now (a linked node_modules is common):
    // Node's ESM loader realpaths the loader module at import time, and a
    // relative config specifier computed from the link-form path would
    // resolve against the wrong directory. Realpathing may also land on
    // another volume, which defeats the whole point — fall through then.
    const real = fs.realpathSync(base);
    if (path.parse(real).root.toLowerCase() === configRoot.toLowerCase()) {
      return real;
    }
  } catch {
    // fall through to the config's own directory
  }
  return path.dirname(configPath);
}

function realpathIfPossible(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}

function nodeConfigLoaderEnv(configPath: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const parts: string[] = [];
  const nodeModules = findNearestNodeModules(path.dirname(configPath));
  if (nodeModules) parts.push(nodeModules);
  if (env.NODE_PATH) parts.push(env.NODE_PATH);
  if (parts.length > 0) {
    env.NODE_PATH = parts.join(path.delimiter);
  }
  return env;
}

function ttsxThroughNodeIfNeeded(binary: string): {
  binary: string;
  prefix: string[];
} {
  const ext = path.extname(binary).toLowerCase();
  if ([".js", ".cjs", ".mjs", ".ts", ".cts", ".mts"].includes(ext)) {
    return { binary: process.execPath, prefix: [binary] };
  }
  return { binary, prefix: [] };
}
