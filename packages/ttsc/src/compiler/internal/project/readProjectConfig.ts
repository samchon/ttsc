import fs from "node:fs";
import path from "node:path";

import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectLocatorOptions } from "../../../structures/internal/ITtscProjectLocatorOptions";
import { readJsoncFile } from "./readJsoncFile";
import { resolveProjectIdentity } from "./resolveProjectIdentity";
import { resolveTsconfigExtends } from "./resolveTsconfigExtends";

/**
 * Read and resolve the project config subset used by ttsc.
 *
 * Follows `extends` chains (including arrays) and merges compiler options with
 * later configs taking precedence. Path-typed options (`baseUrl`,
 * `declarationDir`, `outFile`, `rootDir`, `tsBuildInfoFile`) are resolved
 * relative to the config that declares them. `${configDir}` paths are resolved
 * against the final consuming config after the extends chain is merged. The
 * `outDir` is resolved to an absolute path. Plugins are inherited from the
 * nearest ancestor that declares them.
 */
export function readProjectConfig(
  opts: ITtscProjectLocatorOptions = {},
): ITtscParsedProjectConfig {
  const identity = resolveProjectIdentity(opts);
  const tsconfig = identity.physicalConfigPath;
  const root = identity.physicalProjectRoot;
  const compilerOptions = readResolvedCompilerOptions(
    tsconfig,
    new Set(),
    path.dirname(tsconfig),
  );
  return {
    configPaths: compilerOptions.configPaths,
    compilerOptions: {
      ...compilerOptions.options,
      // A null reset merges as `null`, exactly as the compiler reads it; the
      // parsed shape states an unset output directory as `undefined`.
      outDir:
        typeof compilerOptions.options.outDir === "string"
          ? compilerOptions.options.outDir
          : undefined,
      plugins: compilerOptions.plugins,
    },
    identity,
    path: tsconfig,
    pluginBaseDirs: compilerOptions.pluginBaseDirs,
    root,
  };
}

/**
 * Compiler option keys whose values are file-system paths that must be resolved
 * relative to the tsconfig that declares them, not the project root.
 *
 * `outDir` merges here like every other path option, so a child's `outDir:
 * null` resets an inherited one the way the compiler resets it.
 */
const PATH_OPTIONS = new Set([
  "baseUrl",
  "declarationDir",
  "outDir",
  "outFile",
  "rootDir",
  "tsBuildInfoFile",
]);
const CONFIG_DIR_TEMPLATE = "${configDir}";

/**
 * Intermediate type used during `extends`-chain resolution before the result is
 * projected into `ITtscParsedProjectConfig`.
 */
type ResolvedCompilerOptions = {
  configPaths: string[];
  options: Record<string, unknown>;
  /** Directory of the tsconfig that last declared each option key. */
  optionBaseDirs: Record<string, string>;
  pluginBaseDirs: string[];
  /** True when any tsconfig in the chain explicitly declared `plugins`. */
  pluginsDeclared: boolean;
  plugins: ITtscProjectPluginConfig[];
};
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

/**
 * Resolve `target` against `cwd`, normalized to native separators.
 *
 * An absolute `target` is normalized too, not returned as given. Every path
 * option is resolved once in the config that declares it and again in each
 * config that inherits it, after its separators were folded to `/` for the
 * `${configDir}` check, so returning an absolute value verbatim handed an
 * inherited `rootDir` back as `C:/…/src` on Windows while a declared one came
 * back as `C:\…\src`.
 */
function resolveAbsolutePath(cwd: string, target: string): string {
  return path.resolve(cwd, target);
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
  configDir = path.dirname(tsconfig),
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
        plugins?: unknown;
      };
    };
    const own = parsed.compilerOptions;
    const base = resolveBaseCompilerOptions(
      canonical,
      parsed.extends,
      seen,
      configDir,
    );
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
      configDir,
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
  configDir: string,
): ResolvedCompilerOptions {
  if (typeof extended === "string") {
    return readResolvedCompilerOptions(
      resolveTsconfigExtends(tsconfig, extended),
      seen,
      configDir,
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
      resolveTsconfigExtends(tsconfig, specifier),
      seen,
      configDir,
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
  configDir: string,
): Record<string, unknown> {
  const resolved = { ...options };
  for (const key of PATH_OPTIONS) {
    const value = resolved[key];
    const baseDir = baseDirs[key];
    if (typeof value === "string" && baseDir !== undefined) {
      resolved[key] = resolveCompilerOptionPath(baseDir, configDir, value);
    }
  }
  return resolved;
}

/**
 * Resolve an ordinary path from the config that declares it, but substitute a
 * leading `${configDir}` from the final config consuming the merged preset.
 */
function resolveCompilerOptionPath(
  declaringDir: string,
  configDir: string,
  value: string,
): string {
  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.slice(0, CONFIG_DIR_TEMPLATE.length).toLowerCase() !==
    CONFIG_DIR_TEMPLATE.toLowerCase()
  ) {
    return resolveAbsolutePath(declaringDir, normalized);
  }
  // The compiler picks the base directory from a case-insensitive prefix but
  // substitutes only the exact spelling, so a mis-cased template still anchors
  // here while staying in the path as written. Both halves are reproduced: this
  // function exists to say where the compiler will put the file, and a value
  // the compiler leaves literal is not ours to interpret.
  //
  // The exact spelling becomes "./" before the result is normalized, which
  // keeps the value relative even when its remainder resembles an absolute
  // Windows path. Either config-file separator is accepted on every host.
  const substituted = normalized.startsWith(CONFIG_DIR_TEMPLATE)
    ? `./${normalized.slice(CONFIG_DIR_TEMPLATE.length)}`
    : normalized;
  return resolveAbsolutePath(configDir, substituted);
}
