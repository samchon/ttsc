import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { TYPESCRIPT_TRANSFORM_EXTENSIONS } from "./sourceExtensions";

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

/** Extensions admitted only when `allowJs` widens the program. */
const JAVASCRIPT_INPUT_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs"];

/** Compiler options that exclude exactly one resolved output directory. */
const OUTPUT_DIRECTORY_OPTIONS = ["outDir", "declarationDir"] as const;

/**
 * What the resolved configuration says can and cannot enter the program.
 *
 * The project walk exists to notice files entering and leaving the _program_,
 * so both halves of that question belong to configuration rather than to a
 * guess. Before this the walk answered both from one hardcoded list of
 * directory names, which was wrong in both directions at once: a bundler
 * writing to any directory the list did not name changed project membership
 * with its own output, and a source directory whose name the list did name was
 * dropped from the walk entirely (samchon/ttsc#1307).
 */
export interface ITtscProjectMembershipPolicy {
  /**
   * Absolute directory exclusions separated by the configuration entry that
   * contributed them.
   *
   * Optional for compatibility with hosts that constructed this public policy
   * before exclusion provenance was exposed. Without it, an overlay preserves
   * every entry in `excludedDirectories` as an explicit exclusion because
   * silently admitting a directory is the unsafe fallback.
   */
  directoryExclusionOrigins?: Readonly<{
    declarationDir?: string;
    exclude: readonly string[];
    outDir?: string;
  }>;
  /** Absolute directories the resolved configuration keeps out of the program. */
  excludedDirectories: readonly string[];
  /** Lowercased extensions a file needs to be a possible program input. */
  inputExtensions: readonly string[];
  /**
   * Every config file consulted to produce this policy, the leaf and its whole
   * `extends` ancestry.
   *
   * A caller that memoizes a policy has to know when to stop trusting it, and
   * the leaf alone cannot tell it: adding `exclude` to a shared
   * `tsconfig.base.json` leaves the leaf untouched while changing every answer
   * this policy gives.
   */
  sources: readonly string[];
}

/** Flatten provenance into the directory list consumed by the project walk. */
function flattenDirectoryExclusionOrigins(
  origins: NonNullable<
    ITtscProjectMembershipPolicy["directoryExclusionOrigins"]
  >,
): string[] {
  return [
    ...OUTPUT_DIRECTORY_OPTIONS.flatMap((key) => {
      const directory = origins[key];
      return directory === undefined ? [] : [directory];
    }),
    ...origins.exclude,
  ];
}

/**
 * The policy every project falls back to when no configuration is available.
 *
 * Deliberately the widest one: admitting a file that cannot enter the program
 * costs a compile, while refusing one that can costs correctness, and only the
 * second is a defect the user cannot see.
 */
export const PERMISSIVE_PROJECT_MEMBERSHIP_POLICY: ITtscProjectMembershipPolicy =
  {
    directoryExclusionOrigins: { exclude: [] },
    excludedDirectories: [],
    inputExtensions: [
      ...TYPESCRIPT_TRANSFORM_EXTENSIONS,
      ...JAVASCRIPT_INPUT_EXTENSIONS,
      ".json",
    ],
    sources: [],
  };

/**
 * Read the membership policy the resolved tsconfig implies, following its
 * `extends` chain for every option the answer depends on.
 *
 * `allowJs` and `resolveJsonModule` decide which extensions can enter the
 * program at all, so a `bundle.a1b2c3.js` emitted beside the sources is not a
 * membership change for a project that admits no JavaScript. `outDir`,
 * `declarationDir`, and the plain entries of `exclude` name the directories the
 * program does not contain, which is where a bundler's own output lives in
 * every project that configures one.
 *
 * A glob in `exclude` is skipped rather than approximated. Failing to exclude
 * costs a walk; excluding the wrong tree hides real sources, and this function
 * refuses to guess in the direction that loses correctness.
 */
export function readProjectMembershipPolicy(
  tsconfig: string,
): ITtscProjectMembershipPolicy {
  const resolved = path.resolve(tsconfig);
  // Every config the chain touches, so a caller memoizing this policy can tell
  // when it has gone stale. `findDeclaredValue` walks `extends` for each option
  // independently, and each walk records what it read.
  const sources = new Set<string>();
  const flag = (key: string): boolean =>
    findDeclaredValue(
      resolved,
      (parsed) => {
        const value = (parsed as { compilerOptions?: Record<string, unknown> })
          .compilerOptions?.[key];
        return typeof value === "boolean" ? value : undefined;
      },
      new Set(),
      sources,
    )?.value === true;

  const inputExtensions = [...TYPESCRIPT_TRANSFORM_EXTENSIONS];
  if (flag("allowJs")) {
    inputExtensions.push(...JAVASCRIPT_INPUT_EXTENSIONS);
  }
  if (flag("resolveJsonModule")) {
    inputExtensions.push(".json");
  }

  const directoryExclusionOrigins: {
    declarationDir?: string;
    exclude: string[];
    outDir?: string;
  } = { exclude: [] };
  for (const key of OUTPUT_DIRECTORY_OPTIONS) {
    const declared = findDeclaredValue(
      resolved,
      (parsed) => {
        const value = (parsed as { compilerOptions?: Record<string, unknown> })
          .compilerOptions?.[key];
        return typeof value === "string" && value.length !== 0
          ? value
          : undefined;
      },
      new Set(),
      sources,
    );
    if (declared !== null) {
      directoryExclusionOrigins[key] = path.resolve(
        declared.baseDir,
        declared.value,
      );
    }
  }
  const excluded = findDeclaredValue(
    resolved,
    (parsed) => {
      const value = (parsed as { exclude?: unknown }).exclude;
      return Array.isArray(value) ? value : undefined;
    },
    new Set(),
    sources,
  );
  if (excluded !== null) {
    for (const entry of excluded.value) {
      if (typeof entry !== "string" || entry.length === 0) {
        continue;
      }
      // `dist/**` names exactly one directory; `**/*.spec.ts` names a set this
      // walk cannot evaluate without a matcher, so it is left in.
      const plain = entry.endsWith("/**") ? entry.slice(0, -3) : entry;
      if (plain.length === 0 || /[*?]/.test(plain)) {
        continue;
      }
      directoryExclusionOrigins.exclude.push(
        path.resolve(excluded.baseDir, plain),
      );
    }
  }
  return {
    directoryExclusionOrigins,
    excludedDirectories: flattenDirectoryExclusionOrigins(
      directoryExclusionOrigins,
    ),
    inputExtensions,
    sources: [...sources],
  };
}

/**
 * Apply the caller's compiler-options overlay on top of a policy read from the
 * project config.
 *
 * The overlay wins for the compile, so it wins here too. A caller that turns
 * `allowJs` on gets a program that admits JavaScript, and a membership rule
 * that still refused it would miss files entering that program; a caller that
 * turns it off gets the narrower rule for the same reason.
 */
export function mergeMembershipPolicyOverlay(
  policy: ITtscProjectMembershipPolicy,
  compilerOptions: Record<string, unknown>,
  baseDir: string,
): ITtscProjectMembershipPolicy {
  const inputExtensions = new Set(policy.inputExtensions);
  const applyFlag = (key: string, extensions: readonly string[]): void => {
    const value = compilerOptions[key];
    if (typeof value !== "boolean") {
      return;
    }
    for (const extension of extensions) {
      if (value) {
        inputExtensions.add(extension);
      } else {
        inputExtensions.delete(extension);
      }
    }
  };
  applyFlag("allowJs", JAVASCRIPT_INPUT_EXTENSIONS);
  applyFlag("resolveJsonModule", [".json"]);

  const inheritedOrigins = policy.directoryExclusionOrigins;
  const directoryExclusionOrigins: {
    declarationDir?: string;
    exclude: string[];
    outDir?: string;
  } = {
    declarationDir: inheritedOrigins?.declarationDir,
    exclude: [...(inheritedOrigins?.exclude ?? policy.excludedDirectories)],
    outDir: inheritedOrigins?.outDir,
  };
  for (const key of OUTPUT_DIRECTORY_OPTIONS) {
    const value = compilerOptions[key];
    if (typeof value === "string" && value.length !== 0) {
      directoryExclusionOrigins[key] = path.resolve(baseDir, value);
    }
  }
  return {
    directoryExclusionOrigins,
    excludedDirectories: flattenDirectoryExclusionOrigins(
      directoryExclusionOrigins,
    ),
    inputExtensions: [...inputExtensions],
    sources: policy.sources,
  };
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
  const declared = findDeclaredValue(
    tsconfig,
    (parsed) => {
      const own = (parsed as { compilerOptions?: { paths?: unknown } })
        .compilerOptions?.paths;
      return typeof own === "object" && own !== null && !Array.isArray(own)
        ? (own as Record<string, unknown>)
        : undefined;
    },
    seen,
  );
  return declared === null
    ? null
    : { baseDir: declared.baseDir, paths: declared.value };
}

/**
 * Find the nearest declaration of one config value along the `extends` chain,
 * with the directory of the config that declared it.
 *
 * TypeScript merges configs per key, so the effective value of a key is the
 * whole value from the nearest config that declares one: the config itself
 * first, then its `extends` entries in reverse priority order. The declaring
 * directory travels with the value because a path-valued option (`outDir`,
 * `exclude`) is anchored at the config that wrote it, not at the one that
 * inherited it.
 *
 * Best-effort by design, like {@link readEffectiveTsconfigPaths}: a missing or
 * unparsable config in the chain yields `null` here and a real config error
 * from the compiler, which owns config diagnostics.
 */
function findDeclaredValue<T>(
  tsconfig: string,
  select: (parsed: object) => T | undefined,
  seen: Set<string>,
  /**
   * Every config this walk reads, accumulated across walks. Kept apart from
   * `seen`, which guards one walk against an `extends` cycle and must start
   * empty each time: sharing one set would make the second option's walk treat
   * the leaf as already visited and answer `null` for everything.
   */
  collect?: Set<string>,
): { baseDir: string; value: T } | null {
  const canonical = resolveRealPath(tsconfig);
  if (seen.has(canonical)) {
    return null;
  }
  seen.add(canonical);
  collect?.add(canonical);

  let parsed: { extends?: unknown };
  try {
    parsed = parseJsonc(fs.readFileSync(canonical, "utf8")) as typeof parsed;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const own = select(parsed);
  if (own !== undefined) {
    return { baseDir: path.dirname(canonical), value: own };
  }

  for (const specifier of extendsSpecifiers(parsed.extends).reverse()) {
    const base = resolveExtendsConfig(canonical, specifier);
    if (base === null) {
      // Record where a relative or absolute specifier *would* have resolved,
      // even though nothing is there. A caller stamping this policy has to
      // notice the config appearing later, and a base config can be absent for
      // ordinary reasons: generated during install, or missing across a branch
      // switch. Without this the stamp never moves and a long-lived worker
      // keeps a policy the next run's walk already disagrees with. A bare
      // specifier is skipped, since it has no single candidate path.
      if (isRelativeSpecifier(specifier) || path.isAbsolute(specifier)) {
        // Both spellings the resolver would have tried, since it falls back to
        // `<specifier>.json`. Recording only the literal one leaves the stamp
        // unmoved when `./tsconfig.base` later appears as `tsconfig.base.json`,
        // which is the same staleness this recording exists to prevent.
        const candidate = path.resolve(path.dirname(canonical), specifier);
        collect?.add(candidate);
        // Case-sensitive, because `resolveExistingExtendsPath` is: it appends
        // `.json` unless the spelling already ends in exactly that, so a
        // `./base.JSON` specifier really does resolve to `base.JSON.json` on a
        // case-sensitive filesystem, and the stamp has to know that name.
        if (!candidate.endsWith(".json")) {
          collect?.add(`${candidate}.json`);
        }
      }
      continue;
    }
    const declared = findDeclaredValue(base, select, seen, collect);
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
 * rules: absolute paths and relative specifiers get an exact-file / `.json`
 * fallback; bare specifiers go through Node's module resolver scoped to the
 * declaring config. Returns `null` instead of throwing; the compiler reports
 * unresolvable `extends` itself.
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
  // A bare package root selects its preset through `package.json#tsconfig`,
  // matching TypeScript's config resolution and the core project reader. Such
  // presets often ship no JS/JSON entrypoint, so Node's entrypoint resolver and
  // the `<specifier>.json` fallback both miss them, silently dropping the
  // preset's inherited `paths`.
  const viaManifest = resolvePackageManifestTsconfig(resolver, specifier);
  if (viaManifest !== null) {
    return viaManifest;
  }
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
 * When `specifier` names a bare package root, resolve the config file its
 * `package.json#tsconfig` field selects (anchored at the package directory).
 * Best-effort: returns `null` for a subpath, an unresolvable/unparsable
 * manifest, a missing `tsconfig` field, or a field target that does not exist —
 * the compiler owns the real diagnostic, and this reader must not invent
 * aliases.
 */
function resolvePackageManifestTsconfig(
  resolver: NodeRequire,
  specifier: string,
): string | null {
  if (!isBarePackageRoot(specifier)) {
    return null;
  }
  let manifestPath: string;
  try {
    manifestPath = resolver.resolve(`${specifier}/package.json`);
  } catch {
    return null;
  }
  let field: unknown;
  try {
    const text = fs.readFileSync(manifestPath, "utf8");
    field = (
      JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as {
        tsconfig?: unknown;
      }
    ).tsconfig;
  } catch {
    return null;
  }
  if (typeof field !== "string" || field.length === 0) {
    return null;
  }
  return resolveExistingExtendsPath(
    path.resolve(path.dirname(manifestPath), field),
  );
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
 * Try an on-disk `extends` location as-is and, unless it already ends in
 * `.json`, with that extension appended. A directory is never a config file and
 * cannot be expanded to `tsconfig.json` or a double `.json` suffix.
 */
function resolveExistingExtendsPath(location: string): string | null {
  const candidates = location.endsWith(".json")
    ? [location]
    : [location, `${location}.json`];
  for (const candidate of candidates) {
    if (isFile(candidate)) {
      return resolveRealPath(candidate);
    }
  }
  return null;
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
