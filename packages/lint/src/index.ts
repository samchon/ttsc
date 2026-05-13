import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import type { ITtscLintPlugin, ITtscLintPluginConfig } from "./structures";

export * from "./defineConfig";
export * from "./structures/index";

type TtscPluginContributor = {
  name: string;
  source: string;
};

type TtscPluginDescriptor = {
  name: string;
  source: string;
  stage?: "check" | "transform";
  contributors?: TtscPluginContributor[];
};

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
 * Map a user-facing namespace (`react-hooks`) to a Go-valid sub-package
 * name (`react_hooks`). Required because ttsc's plugin builder uses the
 * `name` field as a directory and import-path suffix, both of which must
 * satisfy Go's stricter `[a-z][a-z0-9_]*` identifier rules. The function
 * is total over namespaces that already passed `NAMESPACE_PATTERN`.
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
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.js",
];

/**
 * Plugin descriptor factory for `@ttsc/lint`.
 *
 * Two discovery surfaces feed the descriptor's `contributors` field:
 *
 * 1. The tsconfig plugin entry's `plugins` map — namespace → npm specifier. Inline
 *    for projects that prefer to keep everything in `tsconfig.json`.
 * 2. The companion `lint.config.{ts,cts,mts,js,cjs,mjs,json}` (or
 *    `eslint.config.*`) file — flat-config-style with an in-memory `plugins: {
 *    ns: pluginObject }` map. The factory evaluates the config (via ttsx for TS
 *    / ESM sources, `require` for CommonJS, `JSON.parse` for JSON) and walks
 *    every entry's `plugins` field.
 *
 * Contributions from both sources are merged with the tsconfig entry winning on
 * namespace collisions, so a project can opt into a hand-curated subset of an
 * external `lint.config.ts` by overriding specific namespaces in
 * `tsconfig.json`.
 */
export default function createTtscPlugin(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): TtscPluginDescriptor {
  const inline = resolveInlineContributors(context);
  const fromConfig = resolveConfigFileContributors(
    context,
    inline.map((c) => c.name),
  );
  const contributors = [...inline, ...fromConfig];
  // Build the descriptor without a `contributors` key when none were
  // declared, so consumers (and the existing key-shape regression
  // tests) see the same surface as before this feature shipped.
  const descriptor: TtscPluginDescriptor = {
    name: "@ttsc/lint",
    source: path.resolve(__dirname, "..", "plugin"),
    stage: "check",
  };
  if (contributors.length > 0) {
    descriptor.contributors = contributors;
  }
  return descriptor;
}

// ────────────────────────────────────────────────────────────────────────────
// tsconfig-inline `plugins` map (the original MVP path)
// ────────────────────────────────────────────────────────────────────────────

function resolveInlineContributors(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): TtscPluginContributor[] {
  const declared = (context.plugin as { plugins?: unknown }).plugins;
  if (declared === undefined) return [];
  if (
    typeof declared !== "object" ||
    declared === null ||
    Array.isArray(declared)
  ) {
    throw new Error(
      `@ttsc/lint: "plugins" in tsconfig plugin entry must be an object map of namespace → package specifier`,
    );
  }
  const out: TtscPluginContributor[] = [];
  // Track the post-`goSubpackageName` form so `a-b` and `a_b` are
  // caught as colliding aliases before they reach the downstream
  // contributor validator's opaque `duplicate name "a_b"` error.
  // (`Object.entries` cannot itself surface duplicate string keys, so
  // a verbatim-namespace guard is unreachable.)
  const seenGoNames = new Map<string, string>();
  for (const [namespace, specifier] of Object.entries(declared)) {
    if (!NAMESPACE_PATTERN.test(namespace)) {
      throw new Error(
        `@ttsc/lint: contributor namespace ${JSON.stringify(namespace)} must match /^[a-z][a-z0-9_-]*$/`,
      );
    }
    if (typeof specifier !== "string" || specifier.length === 0) {
      throw new Error(
        `@ttsc/lint: contributor ${JSON.stringify(namespace)} must point at a non-empty package specifier or path`,
      );
    }
    const goName = goSubpackageName(namespace);
    const earlier = seenGoNames.get(goName);
    if (earlier !== undefined) {
      throw new Error(
        `@ttsc/lint: contributor namespaces ${JSON.stringify(earlier)} and ${JSON.stringify(namespace)} both map to Go sub-package ${JSON.stringify(goName)}; pick one form (hyphens collapse to underscores for the Go identifier)`,
      );
    }
    seenGoNames.set(goName, namespace);
    const plugin = loadContributorPluginViaRequire(
      specifier,
      context,
      namespace,
    );
    out.push({ name: goName, source: plugin.source });
  }
  return out;
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

/** Plugin entries observed in the flat-config file, normalized per file. */
type ConfigPluginEntry = { namespace: string; source: string };

function resolveConfigFileContributors(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
  inlineNames: readonly string[],
): TtscPluginContributor[] {
  // Read the new `rules` / `extends` fields with a one-time fallback to
  // the legacy `config` field. The legacy fallback warns once per
  // ttsc invocation so existing tsconfigs keep working through the
  // deprecation window without crashing CI.
  const { hasInlineRules, extendsPath } = readSeverityConfig(context);
  if (hasInlineRules) {
    // Inline rules → no lint.config.* file involved. Skip discovery so
    // we don't pull in plugins from an unrelated file.
    return [];
  }

  const configPath =
    extendsPath !== undefined
      ? path.resolve(tsconfigBaseDir(context), extendsPath)
      : findLintConfigFile(context);
  if (!configPath || !fs.existsSync(configPath)) return [];

  const entries = readConfigPluginEntries(configPath, context);
  // Dedup against the Go-subpackage form (post hyphen→underscore
  // transform). The inline arm has already applied `goSubpackageName`
  // when it produced `inlineNames`, so comparing on the original
  // hyphenated namespace would always miss for hyphenated namespaces
  // and emit a colliding contributor that `validatePluginContributors`
  // later rejects as a duplicate name.
  const occupied = new Set(inlineNames);
  const out: TtscPluginContributor[] = [];
  for (const entry of entries) {
    const goName = goSubpackageName(entry.namespace);
    if (occupied.has(goName)) continue; // tsconfig inline wins
    occupied.add(goName);
    out.push({ name: goName, source: entry.source });
  }
  return out;
}

/**
 * Resolves the inline-rule vs file-path split between the new `rules` /
 * `extends` fields and the legacy `config` field.
 *
 * - `rules` (object) routes the discovery loop away from any `lint.config.*` file
 *   — the inline map is authoritative.
 * - `extends` (string) routes the file walk to a fixed path.
 * - `config` (legacy) silently maps onto the equivalent new field. The
 *   user-facing deprecation notice is emitted by the Go sidecar so that a
 *   single ttsc invocation prints exactly one warning regardless of how many
 *   entry points (JS factory, Go binary) parse the same key.
 * - Mixing legacy and new keys, or mixing `rules` with `extends`, is rejected
 *   outright so users don't end up with silent precedence surprises.
 */
function readSeverityConfig(
  context: TtscPluginFactoryContext<ITtscLintPluginConfig>,
): { hasInlineRules: boolean; extendsPath: string | undefined } {
  const entry = context.plugin as Record<string, unknown>;
  const rules = entry.rules;
  const extendsRaw = entry.extends;
  const legacy = entry.config;
  const hasNewRules = rules !== undefined;
  const hasExtends = extendsRaw !== undefined;
  const hasLegacy = legacy !== undefined;

  if (hasLegacy && (hasNewRules || hasExtends)) {
    throw new Error(
      `@ttsc/lint: tsconfig plugin entry mixes legacy "config" with the new "rules"/"extends" fields; remove "config" (deprecated)`,
    );
  }
  if (hasNewRules && hasExtends) {
    throw new Error(
      `@ttsc/lint: "rules" and "extends" cannot be combined on a single plugin entry; put base rules in the "extends" file and inline overrides in lint.config.ts itself`,
    );
  }

  if (hasNewRules) {
    if (typeof rules !== "object" || rules === null || Array.isArray(rules)) {
      const actual = Array.isArray(rules)
        ? "array"
        : rules === null
          ? "null"
          : typeof rules;
      throw new Error(
        `@ttsc/lint: "rules" must be a rule severity map, got ${actual}`,
      );
    }
    return { hasInlineRules: true, extendsPath: undefined };
  }
  if (hasExtends) {
    if (typeof extendsRaw !== "string" || extendsRaw.length === 0) {
      throw new Error(`@ttsc/lint: "extends" must be a non-empty string path`);
    }
    return { hasInlineRules: false, extendsPath: extendsRaw };
  }
  if (hasLegacy) {
    if (
      typeof legacy === "object" &&
      legacy !== null &&
      !Array.isArray(legacy)
    ) {
      return { hasInlineRules: true, extendsPath: undefined };
    }
    if (typeof legacy === "string" && legacy.length > 0) {
      return { hasInlineRules: false, extendsPath: legacy };
    }
    throw new Error(
      `@ttsc/lint: legacy "config" must be a non-empty string path or a rule severity map, got ${typeof legacy}`,
    );
  }
  return { hasInlineRules: false, extendsPath: undefined };
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
  let dir = tsconfigBaseDir(context);
  while (true) {
    const matches = LINT_CONFIG_FILENAMES.map((name) =>
      path.join(dir, name),
    ).filter(
      (candidate) =>
        fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    );
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

const TTSX_EXTRACTOR_SCRIPT = `import * as importedConfig from %CONFIG_IMPORT%;

declare const process: {
  argv: string[];
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
  for (let i = 0; i < 4; i++) {
    if (typeof current.source === "string") break;
    const next = current.default;
    if (!isObject(next)) break;
    current = next;
  }
  const source = current.source;
  return typeof source === "string" ? source : undefined;
}
`;

function readTtsxConfigPlugins(
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
    const args = ["--project", tsconfigPath, "--cwd", tempDir, loaderPath];
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
    const mod = requireFromConfig(resolved);
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
