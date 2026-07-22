import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectLocatorOptions } from "../../../structures/internal/ITtscProjectLocatorOptions";
import { readJsonFile, readJsoncFile } from "./readConfigJson";
import { resolveProjectIdentity } from "./resolveProjectConfig";

/**
 * Compiler option keys whose values are file-system paths that must be resolved
 * relative to the tsconfig that declares them, not the project root.
 */
const PATH_OPTIONS = new Set(["baseUrl", "declarationDir", "rootDir"]);

/**
 * Intermediate type used during `extends`-chain resolution before the result is
 * projected into `ITtscParsedProjectConfig`.
 */
type ResolvedCompilerOptions = {
  configPaths: string[];
  options: Record<string, unknown>;
  /** Directory of the tsconfig that last declared each option key. */
  optionBaseDirs: Record<string, string>;
  outDir?: string;
  pluginBaseDirs: string[];
  /** True when any tsconfig in the chain explicitly declared `plugins`. */
  pluginsDeclared: boolean;
  plugins: ITtscProjectPluginConfig[];
};

/**
 * Read and resolve the project config subset used by ttsc.
 *
 * Follows `extends` chains (including arrays) and merges compiler options with
 * later configs taking precedence. Path-typed options (`baseUrl`,
 * `declarationDir`, `rootDir`) are resolved relative to the config that
 * declares them. The `outDir` is resolved to an absolute path. Plugins are
 * inherited from the nearest ancestor that declares them.
 */
export function readProjectConfig(
  opts: ITtscProjectLocatorOptions = {},
): ITtscParsedProjectConfig {
  const identity = resolveProjectIdentity(opts);
  const tsconfig = identity.physicalConfigPath;
  const root = identity.physicalProjectRoot;
  const compilerOptions = readResolvedCompilerOptions(tsconfig);
  return {
    configPaths: compilerOptions.configPaths,
    compilerOptions: {
      ...compilerOptions.options,
      outDir: compilerOptions.outDir,
      plugins: compilerOptions.plugins,
    },
    identity,
    path: tsconfig,
    pluginBaseDirs: compilerOptions.pluginBaseDirs,
    root,
  };
}

/**
 * Type guard: accept any non-null object as a plugin config entry. This is
 * intentionally loose because the shape is validated later by plugin loaders.
 */
function isProjectPluginConfig(
  value: unknown,
): value is ITtscProjectPluginConfig {
  return typeof value === "object" && value !== null;
}

/**
 * Resolve symlinks on `location`, returning the original path when
 * `realpathSync` fails (e.g. when the file does not yet exist).
 */
function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}

/** Resolve `target` against `cwd` when it is not already absolute. */
function resolveAbsolutePath(cwd: string, target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(cwd, target);
}

/**
 * Recursively read and merge `compilerOptions` from `tsconfig` and all configs
 * in its `extends` chain. `seen` tracks canonical paths to detect circular
 * `extends` references; the current config is removed from `seen` in the
 * `finally` block so sibling-referenced configs can be visited again via a
 * different parent.
 */
function readResolvedCompilerOptions(
  tsconfig: string,
  seen: Set<string> = new Set(),
): ResolvedCompilerOptions {
  const canonical = resolveRealPath(tsconfig);
  if (seen.has(canonical)) {
    throw new Error(`ttsc: circular tsconfig extends detected: ${canonical}`);
  }
  seen.add(canonical);
  try {
    const parsed = readJsoncFile(canonical) as {
      extends?: unknown;
      compilerOptions?: Record<string, unknown> & {
        outDir?: unknown;
        plugins?: unknown;
      };
    };
    const own = parsed.compilerOptions;
    const base = resolveBaseCompilerOptions(canonical, parsed.extends, seen);
    const ownBaseDir = path.dirname(canonical);
    const ownOptionBaseDirs =
      own === undefined
        ? {}
        : Object.fromEntries(
            Object.keys(own).map((key) => [key, ownBaseDir] as const),
          );
    const optionBaseDirs = {
      ...base.optionBaseDirs,
      ...ownOptionBaseDirs,
    };
    const options = resolvePathOptions(
      {
        ...base.options,
        ...(own ?? {}),
      },
      optionBaseDirs,
    );
    const ownPlugins = own?.plugins;
    const pluginsDeclared = Array.isArray(ownPlugins);
    const plugins = pluginsDeclared
      ? ownPlugins.filter(isProjectPluginConfig)
      : base.plugins;
    return {
      configPaths: uniquePaths([...base.configPaths, canonical]),
      optionBaseDirs,
      options,
      outDir:
        typeof own?.outDir === "string"
          ? resolveAbsolutePath(ownBaseDir, own.outDir)
          : base.outDir,
      pluginBaseDirs: pluginsDeclared
        ? plugins.map(() => ownBaseDir)
        : base.pluginBaseDirs,
      pluginsDeclared: pluginsDeclared || base.pluginsDeclared,
      plugins,
    };
  } finally {
    seen.delete(canonical);
  }
}

/**
 * Resolve the base compiler options from the `extends` field of a tsconfig.
 *
 * - String: a single base config; options are returned directly.
 * - Array: multiple base configs merged left-to-right (later entries win).
 * - Absent / non-string non-array: returns empty options.
 *
 * Plugin inheritance: when the current config in an array chain explicitly
 * declares `plugins`, subsequent configs in the array do not override them.
 */
function resolveBaseCompilerOptions(
  tsconfig: string,
  extended: unknown,
  seen: Set<string>,
): ResolvedCompilerOptions {
  if (typeof extended === "string") {
    return readResolvedCompilerOptions(
      resolveExtendsConfig(tsconfig, extended),
      seen,
    );
  }
  if (!Array.isArray(extended)) {
    return {
      configPaths: [],
      optionBaseDirs: {},
      options: {},
      pluginBaseDirs: [],
      pluginsDeclared: false,
      plugins: [],
    };
  }
  let merged: ResolvedCompilerOptions = {
    configPaths: [],
    optionBaseDirs: {},
    options: {},
    pluginBaseDirs: [],
    pluginsDeclared: false,
    plugins: [],
  };
  for (const specifier of extended) {
    if (typeof specifier !== "string") {
      continue;
    }
    const current = readResolvedCompilerOptions(
      resolveExtendsConfig(tsconfig, specifier),
      seen,
    );
    merged = {
      configPaths: uniquePaths([...merged.configPaths, ...current.configPaths]),
      optionBaseDirs: {
        ...merged.optionBaseDirs,
        ...current.optionBaseDirs,
      },
      options: {
        ...merged.options,
        ...current.options,
      },
      outDir: current.outDir ?? merged.outDir,
      pluginBaseDirs: current.pluginsDeclared
        ? current.pluginBaseDirs
        : merged.pluginBaseDirs,
      plugins: current.pluginsDeclared ? current.plugins : merged.plugins,
      pluginsDeclared: merged.pluginsDeclared || current.pluginsDeclared,
    };
  }
  return merged;
}

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths)];
}

/**
 * Resolve path-typed compiler options to absolute paths using the directory of
 * the tsconfig that declared each option (`baseDirs`).
 */
function resolvePathOptions(
  options: Record<string, unknown>,
  baseDirs: Record<string, string>,
): Record<string, unknown> {
  const resolved = { ...options };
  for (const key of PATH_OPTIONS) {
    const value = resolved[key];
    const baseDir = baseDirs[key];
    if (typeof value === "string" && baseDir !== undefined) {
      resolved[key] = resolveAbsolutePath(baseDir, value);
    }
  }
  return resolved;
}

/**
 * Resolve an `extends` specifier to an absolute path using the same rules as
 * TypeScript's config resolution:
 *
 * - Absolute path: used directly.
 * - Relative specifier (`./`, `../`, `.`, `..`): resolved against the declaring
 *   tsconfig's directory with fallback extension candidates.
 * - Bare package specifier: resolved through Node's module resolver (the resolver
 *   also tries appending `.json` when the first attempt fails).
 */
function resolveExtendsConfig(tsconfig: string, specifier: string): string {
  const baseDir = path.dirname(tsconfig);
  if (path.isAbsolute(specifier)) {
    return resolveExistingExtendsPath(specifier);
  }
  if (isRelativeSpecifier(specifier)) {
    return resolveExistingExtendsPath(path.resolve(baseDir, specifier));
  }
  const resolver = createRequire(tsconfig);
  // A bare package root selects its preset through `package.json#tsconfig`,
  // matching TypeScript's config resolution. Presets shipped this way often
  // have no JavaScript/JSON entrypoint at all, so Node's entrypoint resolver
  // and the `<specifier>.json` fallback below both miss them.
  const viaManifest = resolvePackageManifestTsconfig(resolver, specifier);
  if (viaManifest !== undefined) {
    return resolveExistingExtendsPath(viaManifest);
  }
  try {
    return resolveRealPath(resolver.resolve(specifier));
  } catch {
    return resolveRealPath(resolver.resolve(`${specifier}.json`));
  }
}

/**
 * When `specifier` names a bare package root, resolve the config file its
 * `package.json#tsconfig` field selects (anchored at the package directory).
 * Returns `undefined` when the specifier is a subpath, the manifest cannot be
 * resolved at all, or it declares no `tsconfig` field, so the caller falls back
 * to Node entrypoint resolution. A manifest that resolves but does not parse
 * throws, naming the file.
 */
function resolvePackageManifestTsconfig(
  resolver: NodeRequire,
  specifier: string,
): string | undefined {
  if (!isBarePackageRoot(specifier)) {
    return undefined;
  }
  let manifestPath: string;
  try {
    manifestPath = resolver.resolve(`${specifier}/package.json`);
  } catch (error) {
    // Node parses a package's manifest while resolving into it, so a malformed
    // preset manifest fails here rather than at the read below. Swallowing it
    // is what turned a broken manifest into the confusing downstream
    // "Cannot find module 'example-preset.json'" from the `extends` fallback,
    // which names a file that was never the problem. Node's own message names
    // the real one, so report it in ttsc's voice instead of continuing.
    if (
      (error as NodeJS.ErrnoException | undefined)?.code ===
      "ERR_INVALID_PACKAGE_CONFIG"
    ) {
      throw new Error(
        `ttsc: failed to parse the package manifest of ${JSON.stringify(specifier)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return undefined;
  }
  // A manifest that exists but does not parse is a real configuration error,
  // and it used to be swallowed here: the read returned `undefined`, the caller
  // fell back to Node entrypoint resolution, and the user learned nothing about
  // the file that actually broke. Report it instead.
  //
  // A manifest that parses to something other than an object carries no
  // `tsconfig` field to read, so it falls back rather than throwing on a
  // property access.
  const manifest = readJsonFile(manifestPath);
  const field =
    typeof manifest === "object" && manifest !== null
      ? (manifest as { tsconfig?: unknown }).tsconfig
      : undefined;
  if (typeof field !== "string" || field.length === 0) {
    return undefined;
  }
  return path.resolve(path.dirname(manifestPath), field);
}

/**
 * Return true when `specifier` is a bare package root (no subpath): a plain
 * package name (`preset`) or a scoped name (`@scope/preset`). Subpaths such as
 * `@scope/preset/base.json` resolve directly and keep their current meaning.
 */
function isBarePackageRoot(specifier: string): boolean {
  if (specifier.startsWith("@")) {
    return specifier.split("/").length === 2;
  }
  return !specifier.includes("/");
}

/**
 * Given an on-disk location, try the path as-is and with `.json` appended.
 * Only regular files are valid `extends` targets; TypeScript does not expand a
 * directory into `tsconfig.json` for this resolution path.
 */
function resolveExistingExtendsPath(location: string): string {
  const candidates = new Set<string>([location, `${location}.json`]);
  for (const candidate of candidates) {
    if (isFile(candidate)) {
      return resolveRealPath(candidate);
    }
  }
  throw new Error(`ttsc: extended tsconfig not found: ${location}`);
}

function isFile(location: string): boolean {
  try {
    return fs.statSync(location).isFile();
  } catch {
    return false;
  }
}

/**
 * Return true when `specifier` is a relative path reference: `.`, `..`, or a
 * string starting with `./`, `../`, `.\\`, or `..\\`.
 */
function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}
