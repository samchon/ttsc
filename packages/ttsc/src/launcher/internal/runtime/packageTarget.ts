import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import {
  TYPESCRIPT_EXTENSIONS,
  findOwningPackageRoot,
  isFile,
  isJavaScriptOutput,
  isTypeScriptSource,
  typeScriptCounterpart,
} from "./paths";

/**
 * Map a resolved (or would-be-resolved) module target to the TypeScript source
 * a raw package ships in its place. Handles the three shapes Node produces: a
 * concrete `.js` whose `.ts` counterpart is published instead, an existing
 * `.ts` target, or an extensionless stem (`./index`) that resolves to a source.
 * Returns `null` when no TypeScript source backs the target.
 */
export function typeScriptForTarget(target: string): string | null {
  if (isTypeScriptSource(target)) {
    return isFile(target) ? target : null;
  }
  if (isJavaScriptOutput(target)) {
    return typeScriptCounterpart(target);
  }
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    if (isFile(target + extension)) {
      return target + extension;
    }
  }
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    const indexed = path.join(target, `index${extension}`);
    if (isFile(indexed)) {
      return indexed;
    }
  }
  return null;
}

/**
 * Resolve the TypeScript source a bare/subpath package specifier maps to when
 * the package's published entry target points at a not-yet-built `.js` file.
 *
 * Node's own resolver picks the target through `exports` (string, array,
 * conditions, or `*` pattern), `main`, or the default `index.js`; this mirrors
 * that selection for the supplied `conditions` (`import` for ESM, `require` for
 * CommonJS) and then swaps the chosen `.js` target for its `.ts` counterpart.
 * Returns `null` when the package cannot be located or exposes no TypeScript
 * source for the requested subpath.
 */
export function resolvePackageTypeScriptTarget(
  specifier: string,
  parentDir: string,
  conditions: readonly string[],
): string | null {
  const parsed = parsePackageSpecifier(specifier);
  if (parsed === null) {
    return null;
  }
  const packageDir = findPackageDir(parsed.name, parentDir);
  if (packageDir === null) {
    return null;
  }
  const manifest = readJson(path.join(packageDir, "package.json"));
  if (manifest === null) {
    return null;
  }
  // Only the first selected target is rescued. Node treats an `exports` array
  // as an ordered fallback and reports the first target; trying a later one on
  // ttsx's own would resolve a package Node itself would have failed to load.
  const [target] = candidateTargets(manifest, parsed.subpath, conditions);
  return target === undefined
    ? null
    : typeScriptForTarget(path.resolve(packageDir, target));
}

interface ParsedSpecifier {
  readonly name: string;
  /** Package-relative subpath as an `exports` key (`"."` for the root). */
  readonly subpath: string;
}

/**
 * Resolve the TypeScript source a Node `imports` (`#`) subpath maps to when its
 * published target points at a not-yet-built `.js` file. Node's CommonJS loader
 * reports `imports` failures without a resolved URL, so unlike `exports` (which
 * the ESM loader rescues from `error.url`) the `#` subpath must be re-derived
 * here from the importer's owning package. Returns `null` for a non-`#`
 * specifier, a relative-less target, or a subpath that backs no `.ts`.
 */
export function resolvePackageImportsTarget(
  specifier: string,
  parentDir: string,
  conditions: readonly string[],
): string | null {
  if (!specifier.startsWith("#")) {
    return null;
  }
  const packageRoot = findOwningPackageRoot(path.join(parentDir, "index.js"));
  if (packageRoot === null) {
    return null;
  }
  const manifest = readJson(path.join(packageRoot, "package.json"));
  if (manifest === null || !isRecord(manifest.imports)) {
    return null;
  }
  const [target] = lookupSubpathMap(manifest.imports, specifier, conditions);
  // Only a package-relative target can map to a co-located `.ts`; a bare or
  // nested `#` target resolves through Node's own machinery.
  if (target === undefined || !target.startsWith(".")) {
    return null;
  }
  return typeScriptForTarget(path.resolve(packageRoot, target));
}

function parsePackageSpecifier(specifier: string): ParsedSpecifier | null {
  if (
    specifier.length === 0 ||
    specifier.startsWith(".") ||
    specifier.startsWith("#")
  ) {
    return null;
  }
  const segments = specifier.split("/");
  const name = specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0]!;
  if (name.length === 0) {
    return null;
  }
  const rest = specifier.slice(name.length).replace(/^\//, "");
  return { name, subpath: rest.length === 0 ? "." : `./${rest}` };
}

function findPackageDir(name: string, parentDir: string): string | null {
  // Resolve the package directory by scanning `node_modules` search paths
  // directly. Resolving `<name>/package.json` would be blocked whenever the
  // package declares `exports` without a `./package.json` entry — exactly the
  // packages whose `.js` entry target this resolver exists to rescue.
  const resolver = createRequire(path.join(parentDir, "noop.js"));
  const searchPaths = resolver.resolve.paths(name) ?? [];
  const segments = name.split("/");
  for (const base of searchPaths) {
    const candidate = path.join(base, ...segments);
    if (isFile(path.join(candidate, "package.json"))) {
      return candidate;
    }
  }
  return null;
}

/** Return the candidate target strings for a subpath, in resolution order. */
function candidateTargets(
  manifest: Record<string, unknown>,
  subpath: string,
  conditions: readonly string[],
): string[] {
  const exports = manifest.exports;
  if (exports !== undefined) {
    return resolveExports(exports, subpath, conditions);
  }
  if (subpath === ".") {
    const main = manifest.main;
    return [
      typeof main === "string" && main.length !== 0 ? main : "./index.js",
    ];
  }
  return [subpath];
}

/**
 * Navigate an `exports` map to the target(s) for a subpath. A bare string is
 * the root target; an array is a fallback list for the same subpath; a subpath
 * map is keyed by exact subpath or a `*` pattern; a plain conditions object is
 * the root entry. Once the subpath is matched, the value is resolved through
 * any remaining conditions/arrays by {@link resolveTargetValue}.
 */
function resolveExports(
  exports: unknown,
  subpath: string,
  conditions: readonly string[],
): string[] {
  if (typeof exports === "string") {
    return subpath === "." ? [exports] : [];
  }
  if (Array.isArray(exports)) {
    return exports.flatMap((entry) =>
      resolveExports(entry, subpath, conditions),
    );
  }
  if (!isRecord(exports)) {
    return [];
  }
  if (!Object.keys(exports).some((key) => key.startsWith("."))) {
    // A conditions object at the top level is the root (".") entry.
    return subpath === "." ? resolveTargetValue(exports, conditions) : [];
  }
  return lookupSubpathMap(exports, subpath, conditions);
}

/**
 * Look up a subpath in a subpath map (`exports`'s `./` keys or `imports`'s `#`
 * keys) by exact key, then by the most specific `*` pattern.
 */
function lookupSubpathMap(
  map: Record<string, unknown>,
  key: string,
  conditions: readonly string[],
): string[] {
  if (key in map) {
    return resolveTargetValue(map[key], conditions);
  }
  return resolvePatternExports(map, key, conditions);
}

/**
 * Resolve a matched export target value into concrete target strings: a string
 * is the target, an array is a fallback list, and a conditions object selects
 * the first active condition's value.
 */
function resolveTargetValue(
  value: unknown,
  conditions: readonly string[],
): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => resolveTargetValue(entry, conditions));
  }
  if (!isRecord(value)) {
    return [];
  }
  // Node selects the first condition in the object's own key order that is
  // active, not the first active condition in caller priority order.
  const active = new Set([...conditions, "default"]);
  for (const key of Object.keys(value)) {
    if (active.has(key)) {
      return resolveTargetValue(value[key], conditions);
    }
  }
  return [];
}

/**
 * Match a `./prefix/*` pattern export and expand its `*` capture. Node selects
 * the pattern with the longest matching prefix (then the longest suffix),
 * independent of key order, so the most specific pattern wins.
 */
function resolvePatternExports(
  exports: Record<string, unknown>,
  subpath: string,
  conditions: readonly string[],
): string[] {
  let best: { key: string; prefix: string; suffix: string } | null = null;
  for (const key of Object.keys(exports)) {
    const star = key.indexOf("*");
    if (star === -1) {
      continue;
    }
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (
      subpath.length < prefix.length + suffix.length ||
      !subpath.startsWith(prefix) ||
      !subpath.endsWith(suffix)
    ) {
      continue;
    }
    if (
      best === null ||
      prefix.length > best.prefix.length ||
      (prefix.length === best.prefix.length &&
        suffix.length > best.suffix.length)
    ) {
      best = { key, prefix, suffix };
    }
  }
  if (best === null) {
    return [];
  }
  const captured = subpath.slice(
    best.prefix.length,
    subpath.length - best.suffix.length,
  );
  return resolveTargetValue(exports[best.key], conditions).map((target) =>
    target.replace(/\*/g, captured),
  );
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
