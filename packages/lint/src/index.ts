import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

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
  plugin: TConfig;
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
 * upward from the tsconfig directory.
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
    capabilities: { diagnosticsTiming: true, lsp: true, threadingArgs: true },
    name: "@ttsc/lint",
    reportsTypeScriptDiagnostics: true,
    source: path.resolve(__dirname, "..", "plugin"),
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

/**
 * Resolves the contributor lint plugins declared in the project's lint config
 * file.
 *
 * - When the tsconfig plugin entry sets `configFile`, that exact file is loaded.
 * - Otherwise a `lint.config.*` / `ttsc-lint.config.*` file is discovered by
 *   walking upward from the tsconfig directory.
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
      ? path.resolve(tsconfigBaseDir(context), configFile)
      : findLintConfigFile(context);
  if (!configPath || !fs.existsSync(configPath)) return [];

  const entries = readConfigPluginEntries(configPath, context);
  // Dedup on the Go-subpackage form (post hyphen→underscore transform)
  // so two namespaces that collapse to the same Go identifier surface
  // here instead of as the contributor validator's opaque
  // `duplicate name "a_b"` error.
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
  // Mirror the Go-side discovery loop: walk from the tsconfig directory
  // upward, returning the first directory that has exactly one of the
  // candidate filenames. Multiple files in the same directory is treated
  // as ambiguous and skipped (the Go side raises a hard error on the
  // duplicate; here we leave it to the binary's own discovery to surface
  // the issue once with one canonical message).
  const candidateSet = new Set<string>(LINT_CONFIG_FILENAMES);
  let dir = tsconfigBaseDir(context);
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
  const ext = path.extname(configPath).toLowerCase();
  if (ext === ".json") {
    return readJsonConfigPlugins(configPath, context);
  }
  if (ext === ".js" || ext === ".cjs") {
    return readCjsConfigPlugins(configPath);
  }
  // .ts, .cts, .mts, .mjs all need ttsx-side evaluation. .mjs sneaks in
  // here because Node can't `require()` an ESM file synchronously.
  return readTtsxConfigPlugins(configPath, context);
}

function readJsonConfigPlugins(
  configPath: string,
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): ConfigPluginEntry[] {
  let parsed: unknown;
  try {
    // Strip a leading UTF-8 BOM so files saved by Windows editors
    // (Notepad++, some VS Code setups) round-trip through `JSON.parse`
    // without an opaque "Unexpected token" failure.
    const text = fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `@ttsc/lint: failed to parse lint config ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  // In JSON, plugin values can only be strings (npm specifiers) — there
  // is no way to attach an in-memory plugin object inside a JSON file.
  return collectPluginObjectsFromConfig(parsed)
    .flatMap((map) => Object.entries(map))
    .map(([namespace, value]): ConfigPluginEntry => {
      if (!NAMESPACE_PATTERN.test(namespace)) {
        throw new Error(
          `@ttsc/lint: lint config ${configPath} namespace ${JSON.stringify(namespace)} must match /^[a-z][a-z0-9_-]*$/`,
        );
      }
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(
          `@ttsc/lint: lint config ${configPath} plugin ${JSON.stringify(namespace)} must point at a package specifier string`,
        );
      }
      const plugin = loadContributorPluginViaRequire(
        value,
        context,
        namespace,
        configPath,
      );
      return { namespace, source: plugin.source };
    });
}

function readCjsConfigPlugins(configPath: string): ConfigPluginEntry[] {
  let mod: unknown;
  try {
    const requireFromConfig = createRequire(configPath);
    mod = requireFromConfig(configPath);
  } catch (error) {
    throw new Error(
      `@ttsc/lint: failed to load lint config ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return collectPluginObjectsFromConfig(unwrapDefault(mod))
    .flatMap((map) => Object.entries(map))
    .map(([namespace, value]) =>
      normalizePluginValue(namespace, value, configPath),
    );
}

// TypeScript source written to a temp file and executed via ttsx. The
// %CONFIG_IMPORT% placeholder is replaced with a JSON-quoted relative path
// before the file hits disk. The script walks the exported config object,
// collects every `plugins` map, and serialises each plugin's `source` field
// as a JSON array for the parent process to parse — avoiding the need to
// serialise arbitrary in-memory plugin objects across the process boundary.
const TTSX_EXTRACTOR_SCRIPT = `import * as importedConfig from %CONFIG_IMPORT%;

declare const process: {
  cwd(): string;
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exit(code?: number): never;
};

try {
  let current: unknown = importedConfig;
  for (let i = 0; i < 8; i++) {
    if (isObject(current) && hasOwn(current, "default")) {
      current = (current as Record<string, unknown>).default;
      continue;
    }
    break;
  }
  if (typeof current === "function") {
    current = await (current as () => unknown | Promise<unknown>)();
  }
  const pluginMaps = collectPluginObjects(current);
  const entries: Array<{ namespace: string; source: string }> = [];
  for (const map of pluginMaps) {
    for (const [namespace, value] of Object.entries(map)) {
      const source = extractPluginSource(value);
      if (source === undefined) continue;
      entries.push({ namespace, source });
    }
  }
  process.stdout.write(JSON.stringify({ entries }));
} catch (error) {
  process.stderr.write(error instanceof Error && error.stack ? error.stack : String(error));
  process.exit(1);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
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
  if (typeof value === "string") return value;
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
 * Resolves the contributor plugin entries declared in a .ts/.mjs lint config,
 * memoized through the shared on-disk config cache.
 *
 * Evaluating such a config spawns a full `ttsx` subprocess. A monorepo build
 * runs one `ttsc` process per package, and each would otherwise re-spawn `ttsx`
 * for the same shared config; the cache collapses that to a single evaluation.
 * The cache is keyed by the config file's path and exact contents (see
 * `configCacheKey`), so an edit re-evaluates cleanly.
 */
function readTtsxConfigPlugins(
  configPath: string,
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): ConfigPluginEntry[] {
  const cacheKey = configCacheKey("plugins", configPath);
  if (cacheKey) {
    const cached = readConfigPluginCache(cacheKey);
    // Re-validate cached entries before trusting them: a contributor's
    // resolved `source` directory may have moved since the entry was
    // written. A stale entry falls through to a fresh evaluation rather
    // than being forwarded to ttsc's plugin builder as a dead path.
    if (cached && cached.every(isValidConfigPluginEntry)) return cached;
  }
  const entries = evaluateTtsxConfigPlugins(configPath, context);
  if (cacheKey) writeConfigPluginCache(cacheKey, entries);
  return entries;
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
  _context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): ConfigPluginEntry[] {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-cfg-"));
  try {
    linkNearestNodeModules(tempDir, path.dirname(configPath));
    const loaderPath = path.join(tempDir, "loader.mts");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const importSpecifier = relativeImportSpecifier(tempDir, configPath);
    const loaderSource = TTSX_EXTRACTOR_SCRIPT.replace(
      "%CONFIG_IMPORT%",
      JSON.stringify(importSpecifier),
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
            rootDir: "/",
            skipLibCheck: true,
            strict: false,
            target: "ES2022",
          },
          files: [
            loaderPath.replace(/\\/g, "/"),
            configPath.replace(/\\/g, "/"),
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
      // 60s cap so a runaway top-level await / infinite loop in the
      // user's lint config can't hang the entire ttsc invocation.
      timeout: 60_000,
      windowsHide: true,
    });
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
        `@ttsc/lint: lint config ${configPath} evaluation failed:\n${result.stderr || result.stdout}`,
      );
    }
    let payload: { entries?: ConfigPluginEntry[] };
    try {
      payload = JSON.parse(result.stdout) as { entries?: ConfigPluginEntry[] };
    } catch (error) {
      throw new Error(
        `@ttsc/lint: lint config ${configPath} evaluator returned invalid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const entries = payload.entries ?? [];
    return entries.map((entry) => {
      // The ttsx extractor already resolved each plugin object's
      // `source` to an absolute directory path. Validate the shape but
      // skip the specifier-resolution branch — re-routing a directory
      // through `createRequire().resolve` would fail.
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
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Config cache (shared with the Go sidecar — packages/lint/linthost/config.go)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Namespaces the on-disk config cache. Kept in lockstep with the Go sidecar's
 * `configCacheVersion`; bump both when the cached shape changes.
 */
const CONFIG_CACHE_VERSION = "v1";

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
): ConfigPluginEntry[] | undefined {
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
    return Array.isArray(parsed) ? (parsed as ConfigPluginEntry[]) : undefined;
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
  entries: ConfigPluginEntry[],
): void {
  try {
    const dir = configCacheDir();
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `${cacheKey}.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(entries), "utf8");
    fs.renameSync(tmp, path.join(dir, `${cacheKey}.json`));
  } catch {
    // Cold cache on failure — the next invocation re-evaluates.
  }
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

function relativeImportSpecifier(fromDir: string, target: string): string {
  let rel = path.relative(fromDir, target).replace(/\\/g, "/");
  if (!rel.startsWith("./") && !rel.startsWith("../")) {
    rel = "./" + rel;
  }
  return rel;
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
