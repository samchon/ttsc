import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectLocatorOptions } from "../../../structures/internal/ITtscProjectLocatorOptions";
import { resolveProjectConfig } from "./resolveProjectConfig";

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
  const tsconfig = resolveProjectConfig(opts);
  const root = opts.projectRoot
    ? path.resolve(opts.cwd ?? process.cwd(), opts.projectRoot)
    : path.dirname(tsconfig);
  const compilerOptions = readResolvedCompilerOptions(tsconfig);
  return {
    compilerOptions: {
      ...compilerOptions.options,
      outDir: compilerOptions.outDir,
      plugins: compilerOptions.plugins,
    },
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
    const parsed = parseJsonc(fs.readFileSync(canonical, "utf8")) as {
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
      optionBaseDirs: {},
      options: {},
      pluginBaseDirs: [],
      pluginsDeclared: false,
      plugins: [],
    };
  }
  let merged: ResolvedCompilerOptions = {
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
  try {
    return resolveRealPath(resolver.resolve(specifier));
  } catch {
    return resolveRealPath(resolver.resolve(`${specifier}.json`));
  }
}

/**
 * Given an on-disk location, try the path as-is, with `.json` appended, and as
 * a directory containing `tsconfig.json`. Returns the first match or throws.
 */
function resolveExistingExtendsPath(location: string): string {
  const candidates = new Set<string>([
    location,
    `${location}.json`,
    path.join(location, "tsconfig.json"),
  ]);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return resolveRealPath(candidate);
    }
  }
  throw new Error(`ttsc: extended tsconfig not found: ${location}`);
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

/**
 * Parse a JSONC (JSON with Comments) string by stripping comments and trailing
 * commas before handing off to `JSON.parse`.
 */
function parseJsonc(input: string): unknown {
  return JSON.parse(stripTrailingCommas(stripComments(input)));
}

/**
 * Remove `//` line comments and `/* block comments *\/` from a JSONC string.
 * Correctly handles strings that contain comment-like character sequences by
 * tracking string boundaries and escape characters.
 */
function stripComments(input: string): string {
  let output = "";
  let inBlockComment = false;
  let inLineComment = false;
  let inString = false;
  let quote = "";
  let escape = false;

  for (let i = 0; i < input.length; i += 1) {
    const current = input[i]!;
    const next = input[i + 1];

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false;
        output += current;
      }
      continue;
    }
    if (inString) {
      output += current;
      if (escape) {
        escape = false;
      } else if (current === "\\") {
        escape = true;
      } else if (current === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      quote = current;
      output += current;
      continue;
    }
    if (current === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (current === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }
    output += current;
  }
  return output;
}

/**
 * Remove trailing commas before `}` or `]` from a JSON string (after comments
 * have already been stripped). Handles string boundaries and escape characters
 * to avoid removing commas inside string values.
 */
function stripTrailingCommas(input: string): string {
  let output = "";
  let inString = false;
  let quote = "";
  let escape = false;

  for (let i = 0; i < input.length; i += 1) {
    const current = input[i]!;
    if (inString) {
      output += current;
      if (escape) {
        escape = false;
      } else if (current === "\\") {
        escape = true;
      } else if (current === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      quote = current;
      output += current;
      continue;
    }
    if (current === ",") {
      const next = nextNonWhitespace(input, i + 1);
      if (next === "}" || next === "]") {
        continue;
      }
    }
    output += current;
  }
  return output;
}

/**
 * Return the first non-whitespace character at or after position `from` in
 * `input`, or `undefined` when only whitespace remains. Used by
 * `stripTrailingCommas` to detect whether a comma is trailing.
 */
function nextNonWhitespace(input: string, from: number): string | undefined {
  for (let i = from; i < input.length; i += 1) {
    const current = input[i]!;
    if (/\s/.test(current) === false) {
      return current;
    }
  }
  return undefined;
}
