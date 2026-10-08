import fs from "node:fs";
import path from "node:path";

import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectLocatorOptions } from "../../../structures/internal/ITtscProjectLocatorOptions";
import { readJsoncFile } from "./readJsoncFile";
import { resolveProjectIdentity } from "./resolveProjectIdentity";
import { resolveTsconfigExtends } from "./resolveTsconfigExtends";
import { tsconfigExtendsFileCandidates } from "./tsconfigExtendsFileCandidates";

/**
 * Read and resolve the project config subset used by ttsc.
 *
 * Follows `extends` chains (including arrays) and merges compiler options with
 * later configs taking precedence. Path-typed options (`baseUrl`,
 * `declarationDir`, `outFile`, `rootDir`, `tsBuildInfoFile`) are resolved
 * relative to the config that declares them. `${configDir}` paths are resolved
 * against the final consuming config after the extends chain is merged. The
 * `outDir` is resolved to an absolute path when it is a string; a null reset
 * becomes undefined in the returned shape. A declared plugins array replaces
 * inheritance, including an empty array. Array presets merge left to right,
 * with the last branch carrying a declaration supplying plugin entries and
 * their declaring directories. Non-object plugin entries are filtered here;
 * descriptor validation remains with the plugin loader.
 *
 * Config observations include selected lexical paths and missing candidates
 * that could change selection. Package/import-map `extends` uses Node's
 * resolver, whose complete search authority is not exposed here; such a chain
 * marks `configInputsComplete` false and cannot authorize persistent reuse.
 * Completed ancestors are shared only within this read. Each incoming extends
 * edge still selects and observes its lexical candidates before reuse; config
 * bytes, canonical declaring directories and the final configDir are shared
 * within the invocation. Another read performs fresh discovery and evaluation.
 *
 * @param opts Config selection, invocation directory and optional project root.
 * @returns Resolved options, plugin origins, selected identity and config
 *   inputs.
 * @throws When selection, parsing or inheritance fails, including circular
 *   extends chains. Native read failures propagate from the shared reader.
 * @evidence contracts/common.md#principled-implementation Recursive left-to-right option merging retains each declaring directory and final configDir substitution; selected and missing config candidates are recorded, while module inheritance explicitly lacks complete freshness proof.
 * @evidence contracts/common.md#clear-and-simple-design Identity selection, extends resolution and JSONC parsing stay with their shared owners; one recursive merge returns options, plugin origins and config observations together. Separate active and completed collections distinguish circular dependencies from reusable ancestors.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing candidates are real selection premises, and incomplete Node module topology is marked unproved instead of imitated by a guessed package resolver or cache bypass.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc separates option inheritance, path anchors and observation limitations; native member comments and separated tags follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native resolution and realpath preserve distinct lexical and physical config identities; option separators and configDir substitution use the shared host-neutral config rule rather than POSIX concatenation.
 * @evidence contracts/performance.md#efficient-algorithms Each distinct canonical config is read, parsed and merged once; each outgoing extends edge of those configs performs native selection and realpath before completed lookup, so shared diamonds no longer expand by inheritance-path count. Record merging and ordered configPaths copies still scale with accumulated option/path volume and can be quadratic along long chains or wide arrays. Candidate observations use a Set and one final sort; native resolution and path-text processing retain their delegated costs.
 * @evidence contracts/performance.md#reuse-equivalent-work One invocation-owned Map shares completed canonical results after incoming lexical selection observations and active-stack cycle checks. Outgoing resolution always uses the canonical declaring file and all entries share the invocation's final configDir, so aliases do not change the merge context. Observed outgoing premises and incomplete module authority are retained with the shared result. No entry survives the read, and independent loader stability reads remain fresh; this synchronous operation does not claim an atomic filesystem snapshot.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The active Set and completed Map belong to one read and retain at most its distinct reachable configs, with merged records/path lists proportional to each reachable subtree. They become reclaimable on return or failure; finally removes active membership, and no historical cache or live handle survives the invocation.
 */
export function readProjectConfig(
  opts: ITtscProjectLocatorOptions = {},
): ITtscParsedProjectConfig {
  const configInputs = new Set<string>();
  const onInput = (file: string): void => {
    configInputs.add(path.resolve(file));
  };
  const identity = resolveProjectIdentity(opts, onInput);
  const tsconfig = identity.physicalConfigPath;
  const root = identity.physicalProjectRoot;
  const compilerOptions = readResolvedCompilerOptions(
    tsconfig,
    new Set(),
    new Map(),
    path.dirname(tsconfig),
    onInput,
  );
  return {
    configInputs: [...configInputs].sort(),
    configInputsComplete: compilerOptions.configInputsComplete,
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
  /** Whether every supported config-resolution authority was observed. */
  configInputsComplete: boolean;

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
 * `${configDir}` check, so returning an absolute value verbatim would hand an
 * inherited `rootDir` back as `C:/…/src` on Windows while a declared one comes
 * back as `C:\…\src`.
 */
function resolveAbsolutePath(cwd: string, target: string): string {
  return path.resolve(cwd, target);
}

/**
 * Recursively read and merge `compilerOptions` from `tsconfig` and all configs
 * in its `extends` chain. Active canonical paths reject circular references
 * before completed results are considered. Incoming selection observations
 * happen before this call; each completed canonical file has already observed
 * its outgoing edges under the same canonical anchor and final configDir.
 * Parent merges copy records and never mutate the shared completed result.
 */
function readResolvedCompilerOptions(
  tsconfig: string,
  seen: Set<string>,
  completed: Map<string, ResolvedCompilerOptions>,
  configDir: string,
  onInput?: (file: string) => void,
): ResolvedCompilerOptions {
  onInput?.(tsconfig);
  const canonical = resolveRealPath(tsconfig);
  if (seen.has(canonical)) {
    throw new Error(`ttsc: circular tsconfig extends detected: ${canonical}`);
  }
  const cached = completed.get(canonical);
  if (cached !== undefined) return cached;
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
      completed,
      configDir,
      onInput,
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
    const resolved: ResolvedCompilerOptions = {
      configInputsComplete: base.configInputsComplete,
      configPaths: uniquePaths([...base.configPaths, canonical]),
      optionBaseDirs,
      options,
      pluginBaseDirs: pluginsDeclared
        ? plugins.map(() => ownBaseDir)
        : base.pluginBaseDirs,
      pluginsDeclared: pluginsDeclared || base.pluginsDeclared,
      plugins,
    };
    completed.set(canonical, resolved);
    return resolved;
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
 * Plugin inheritance follows the last array entry that explicitly declares
 * `plugins`; a later entry that merely inherits no declaration does not erase
 * an earlier declaration.
 */
function resolveBaseCompilerOptions(
  tsconfig: string,
  extended: unknown,
  seen: Set<string>,
  completed: Map<string, ResolvedCompilerOptions>,
  configDir: string,
  onInput?: (file: string) => void,
): ResolvedCompilerOptions {
  if (typeof extended === "string") {
    const inherited = readResolvedCompilerOptions(
      resolveTsconfigExtends(tsconfig, extended, onInput),
      seen,
      completed,
      configDir,
      onInput,
    );
    return {
      ...inherited,
      configInputsComplete:
        inherited.configInputsComplete &&
        tsconfigExtendsFileCandidates(tsconfig, extended) !== undefined,
    };
  }
  if (!Array.isArray(extended)) {
    return {
      configInputsComplete: true,
      configPaths: [],
      optionBaseDirs: {},
      options: {},
      pluginBaseDirs: [],
      pluginsDeclared: false,
      plugins: [],
    };
  }
  let merged: ResolvedCompilerOptions = {
    configInputsComplete: true,
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
      resolveTsconfigExtends(tsconfig, specifier, onInput),
      seen,
      completed,
      configDir,
      onInput,
    );
    merged = {
      configInputsComplete:
        merged.configInputsComplete &&
        current.configInputsComplete &&
        tsconfigExtendsFileCandidates(tsconfig, specifier) !== undefined,
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
