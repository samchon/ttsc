import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Read the effective `compilerOptions.paths` of a tsconfig, following its
 * `extends` chain, and absolutize every mapping target.
 *
 * TypeScript merges `compilerOptions` per option key, so the effective `paths`
 * is the whole object from the nearest config in the chain that declares one
 * (own config first, then `extends` entries in reverse priority order).
 * Relative targets are anchored at the directory of the config that declares
 * them. TypeScript-Go resolves inherited relative `paths` against the declaring
 * file, not the extending one.
 *
 * The generated transform tsconfig replaces `paths` wholesale (standard
 * `extends` semantics), so the alias overlay must re-state these base mappings
 * or every tsconfig-only alias silently stops resolving. Absolutizing is
 * required because the generated config lives in a system temp directory and
 * TypeScript-Go rejects non-relative targets (TS5090) while accepting absolute
 * ones.
 *
 * Best-effort by design: a missing or unparsable config in the chain yields
 * `{}` here and a real config error from the compiler, which owns config
 * diagnostics.
 */
export function readEffectiveTsconfigPaths(
  tsconfig: string,
): Record<string, string[]> {
  const declared = findDeclaredPaths(path.resolve(tsconfig), new Set());
  if (declared === null) {
    return {};
  }
  const output: Record<string, string[]> = {};
  for (const [key, targets] of Object.entries(declared.paths)) {
    if (!Array.isArray(targets)) {
      continue;
    }
    const absolute = targets
      .filter((target): target is string => typeof target === "string")
      .map((target) => absolutizePathsTarget(declared.baseDir, target));
    if (absolute.length !== 0) {
      output[key] = absolute;
    }
  }
  return output;
}

/**
 * Anchor a single `paths` target at `baseDir` unless it is already absolute,
 * normalizing to forward slashes. The `*` wildcard survives `path.resolve` as a
 * literal segment, so patterns like `./src/*` stay patterns.
 */
export function absolutizePathsTarget(baseDir: string, target: string): string {
  const resolved = path.isAbsolute(target)
    ? target
    : path.resolve(baseDir, target);
  return resolved.replace(/\\/g, "/");
}

/**
 * The `paths` object found while walking one tsconfig's `extends` chain,
 * together with the directory of the config that declared it (the anchor for
 * relative targets).
 */
interface IDeclaredPaths {
  baseDir: string;
  paths: Record<string, unknown>;
}

/**
 * Locate the nearest `compilerOptions.paths` declaration in the `extends` chain
 * rooted at `tsconfig`. The own config wins over its bases; within an `extends`
 * array, later entries win over earlier ones. `seen` breaks circular chains;
 * the compiler reports the actual config error.
 */
function findDeclaredPaths(
  tsconfig: string,
  seen: Set<string>,
): IDeclaredPaths | null {
  const canonical = resolveRealPath(tsconfig);
  if (seen.has(canonical)) {
    return null;
  }
  seen.add(canonical);

  let parsed: { extends?: unknown; compilerOptions?: { paths?: unknown } };
  try {
    parsed = parseJsonc(fs.readFileSync(canonical, "utf8")) as typeof parsed;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const own = parsed.compilerOptions?.paths;
  if (typeof own === "object" && own !== null && !Array.isArray(own)) {
    return {
      baseDir: path.dirname(canonical),
      paths: own as Record<string, unknown>,
    };
  }

  for (const specifier of extendsSpecifiers(parsed.extends).reverse()) {
    const base = resolveExtendsConfig(canonical, specifier);
    if (base === null) {
      continue;
    }
    const declared = findDeclaredPaths(base, seen);
    if (declared !== null) {
      return declared;
    }
  }
  return null;
}

/** Normalize the `extends` field into a list of string specifiers. */
function extendsSpecifiers(extended: unknown): string[] {
  if (typeof extended === "string") {
    return [extended];
  }
  if (Array.isArray(extended)) {
    return extended.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }
  return [];
}

/**
 * Resolve an `extends` specifier to an absolute config path using TypeScript's
 * rules: absolute paths and relative specifiers get `.json` /
 * `tsconfig.json`-directory fallbacks; bare specifiers go through Node's module
 * resolver scoped to the declaring config. Returns `null` instead of throwing;
 * the compiler reports unresolvable `extends` itself.
 */
function resolveExtendsConfig(
  tsconfig: string,
  specifier: string,
): string | null {
  if (path.isAbsolute(specifier)) {
    return resolveExistingExtendsPath(specifier);
  }
  if (isRelativeSpecifier(specifier)) {
    return resolveExistingExtendsPath(
      path.resolve(path.dirname(tsconfig), specifier),
    );
  }
  const resolver = createRequire(tsconfig);
  try {
    return resolveRealPath(resolver.resolve(specifier));
  } catch {
    try {
      return resolveRealPath(resolver.resolve(`${specifier}.json`));
    } catch {
      return null;
    }
  }
}

/**
 * Try an on-disk `extends` location as-is, with `.json` appended, and as a
 * directory containing `tsconfig.json`. Returns the first existing match.
 */
function resolveExistingExtendsPath(location: string): string | null {
  for (const candidate of new Set([
    location,
    `${location}.json`,
    path.join(location, "tsconfig.json"),
  ])) {
    if (fs.existsSync(candidate)) {
      return resolveRealPath(candidate);
    }
  }
  return null;
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
 * Resolve symlinks on `location`, returning the original path when
 * `realpathSync` fails (e.g. when the file does not exist).
 */
function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}

/**
 * Parse a JSONC (JSON with Comments) string by stripping comments and trailing
 * commas before handing off to `JSON.parse`. A leading UTF-8 BOM is dropped;
 * `JSON.parse` rejects it, and this reader must not lose `paths` for a config
 * the compiler accepts.
 */
function parseJsonc(input: string): unknown {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  return JSON.parse(stripTrailingCommas(stripComments(text)));
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
