import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { readJsonFile } from "../../../compiler/internal/project/readJsonFile";

/**
 * How ttsc finds a plugin package and reads its manifest.
 *
 * A plugin is named in `tsconfig.json` or discovered through a direct
 * dependency's `package.json`. Resolution follows Node's own rules with one
 * addition, the `ttsc` export condition, which lets a package point plugin
 * loading at a runtime-free descriptor instead of its runtime barrel.
 */
export namespace PluginPackageResolution {
  /** The fields of a `package.json` plugin discovery reads. */
  export type PackageManifest = {
    /** Runtime dependencies; scanned for packages that declare plugins. */
    dependencies?: Record<string, unknown>;
    /** Development dependencies; scanned the same way. */
    devDependencies?: Record<string, unknown>;
    /** The export map, including an optional `ttsc` condition. */
    exports?: unknown;
    /** Legacy CommonJS entry. */
    main?: unknown;
    /** Legacy ES module entry. */
    module?: unknown;
    /** Package name. */
    name?: unknown;
    /** Ttsc's own manifest block, declaring the package's plugins. */
    ttsc?: unknown;
  };

  /** Whether `file` exists and is a regular file, following links. */
  export function existingFile(file: string): boolean {
    try {
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  }

  /**
   * The names of the project's direct dependencies and dev dependencies, each
   * once, in manifest order. Only these are scanned for automatic plugins.
   */
  export function directDependencyNames(manifest: PackageManifest): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const dependencies of [
      manifest.dependencies,
      manifest.devDependencies,
    ]) {
      if (!isRecord(dependencies)) {
        continue;
      }
      for (const name of Object.keys(dependencies)) {
        if (seen.has(name)) {
          continue;
        }
        seen.add(name);
        out.push(name);
      }
    }
    return out;
  }

  /**
   * The physical `package.json` of dependency `name` as seen from the project:
   * the project's own `node_modules/<name>` first, then Node resolution of
   * `<name>/package.json`, then the manifest nearest to the package's main entry
   * for a package whose exports hide its manifest.
   */
  export function resolveDependencyPackageJson(
    name: string,
    projectRoot: string,
  ): string | undefined {
    const direct = path.join(projectRoot, "node_modules", ...name.split("/"));
    const directManifest = path.join(direct, "package.json");
    if (existingFile(directManifest)) {
      return resolveRealPath(directManifest);
    }
    const projectPackage = path.join(projectRoot, "package.json");
    const projectRequire = createRequire(projectPackage);
    try {
      return resolveRealPath(projectRequire.resolve(`${name}/package.json`));
    } catch {
      try {
        return findNearestPackageJson(projectRequire.resolve(name));
      } catch {
        return undefined;
      }
    }
  }

  /**
   * The physical path of the nearest `package.json` at or above `location`, the
   * manifest whose scope the file belongs to.
   */
  export function findNearestPackageJson(location: string): string | undefined {
    const selected =
      collectNearestPackageJsonCandidates(location).find(existingFile);
    return selected === undefined ? undefined : resolveRealPath(selected);
  }

  /** Every package-scope candidate through the first regular manifest file. */
  export function collectNearestPackageJsonCandidates(
    location: string,
  ): string[] {
    let current = fs.statSync(location).isDirectory()
      ? location
      : path.dirname(location);
    const candidates: string[] = [];
    while (true) {
      const manifest = path.resolve(current, "package.json");
      candidates.push(manifest);
      if (existingFile(manifest)) return candidates;
      const parent = path.dirname(current);
      if (parent === current) return candidates;
      current = parent;
    }
  }

  /**
   * Read a package manifest, or `undefined` when the file is absent or is not a
   * JSON object. A malformed manifest throws naming the file: these are usually
   * files the user did not author, which makes an unattributed `JSON.parse`
   * message worse here than anywhere else.
   */
  export function readPackageManifest(
    file: string,
  ): PackageManifest | undefined {
    if (!existingFile(file)) {
      return undefined;
    }
    const parsed = readJsonFile(file);
    return isRecord(parsed) ? (parsed as PackageManifest) : undefined;
  }

  /** Whether a parsed JSON value is an object (arrays included). */
  export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  /**
   * The physical file a plugin specifier names, resolved from the project root.
   *
   * Absolute and relative specifiers are paths. A package specifier honors the
   * package's `ttsc` export condition first, so a package whose main entry is a
   * runtime barrel can point plugin loading at a runtime-free descriptor, and
   * otherwise resolves as Node would.
   */
  export function resolvePluginRequest(
    specifier: string,
    projectRoot: string,
  ): string {
    if (path.isAbsolute(specifier)) {
      return resolveRealPath(specifier);
    }
    if (isRelativePluginSpecifier(specifier)) {
      return resolveRealPath(path.resolve(projectRoot, specifier));
    }
    // A package whose main `.` entry is a runtime barrel cannot double as a
    // plugin descriptor entry: loading it during plugin bootstrap drags the
    // runtime in (and, for a self-hosting transform like typia, deadlocks —
    // loading the transform would have to build the runtime the transform
    // emits). Such a package opts in with a `ttsc` export condition that points
    // at a runtime-free descriptor; honour it here, scoped to plugin resolution.
    const conditioned = resolvePluginExportCondition(specifier, projectRoot);
    if (conditioned !== null) {
      return conditioned;
    }
    return resolveRealPath(
      require.resolve(specifier, { paths: [projectRoot] }),
    );
  }

  /**
   * Condition names ttsc activates when resolving a plugin entry's package
   * `exports`.
   */
  const PLUGIN_EXPORT_CONDITIONS: readonly string[] = [
    "ttsc",
    "node",
    "require",
    "default",
  ];

  /**
   * Resolve a bare plugin specifier under the dedicated `ttsc` export condition.
   *
   * A package whose `.` entry is a runtime barrel (e.g. `typia`, whose index
   * re-exports the whole validator runtime) cannot serve as the plugin descriptor
   * entry: loading it during plugin bootstrap pulls the runtime in and, for a
   * self-hosting transform, forms a cycle. Such a package opts in by adding a
   * `ttsc` condition to its `exports` that points at a runtime-free descriptor:
   *
   * "exports": { ".": { "ttsc": "./lib/transform.js", "default": "./lib/index.js"
   * } }
   *
   * The condition is honoured ONLY here, scoped to plugin-entry resolution. A
   * process-wide `--conditions=ttsc` would also redirect the package's normal
   * `import`s to the descriptor and break its runtime, so it must not be used.
   *
   * Returns an absolute path when the package opts in, or `null` to fall back to
   * the normal `require.resolve` — no `exports`, no `ttsc` branch for the
   * requested subpath, or an unresolved/missing target — so a package that does
   * not opt in resolves exactly as it did before.
   */
  function resolvePluginExportCondition(
    specifier: string,
    baseDir: string,
  ): string | null {
    const split = splitPackageSpecifier(specifier);
    if (split === null) {
      return null;
    }
    const packageJson = resolveDependencyPackageJson(
      split.packageName,
      baseDir,
    );
    if (packageJson === undefined) {
      return null;
    }
    const exportsField = readPackageManifest(packageJson)?.exports;
    if (exportsField === undefined) {
      return null;
    }
    const target = selectExportTarget(exportsField, split.subpath);
    // Only take over when the package actually opts in with a `ttsc` condition
    // for this subpath; otherwise defer so behaviour is unchanged for every
    // package that does not.
    if (target === undefined || !containsCondition(target, "ttsc")) {
      return null;
    }
    const resolved = resolveConditionalTarget(target, PLUGIN_EXPORT_CONDITIONS);
    if (resolved === null || !resolved.startsWith("./")) {
      return null;
    }
    const file = path.resolve(path.dirname(packageJson), resolved);
    return existingFile(file) ? resolveRealPath(file) : null;
  }

  /**
   * Split a bare specifier into its package name and the `.`-prefixed subpath it
   * addresses (`"typia"` → `.`, `"typia/lib/transform"` → `./lib/transform`,
   * `"@scope/pkg/sub"` → `./sub`). Returns `null` for a relative/empty specifier
   * or a malformed scoped name.
   */
  function splitPackageSpecifier(
    specifier: string,
  ): { packageName: string; subpath: string } | null {
    if (specifier.length === 0 || specifier.startsWith(".")) {
      return null;
    }
    const segments = specifier.split("/");
    const nameSegments = specifier.startsWith("@") ? 2 : 1;
    if (segments.length < nameSegments) {
      return null;
    }
    const rest = segments.slice(nameSegments).join("/");
    return {
      packageName: segments.slice(0, nameSegments).join("/"),
      subpath: rest.length === 0 ? "." : `./${rest}`,
    };
  }

  /**
   * The `exports` entry addressing `subpath`, applying Node's rule that an
   * `exports` value with no `.`-prefixed keys is sugar for the `.` target.
   * Returns `undefined` when no entry addresses the subpath.
   */
  function selectExportTarget(exportsField: unknown, subpath: string): unknown {
    if (typeof exportsField === "string" || Array.isArray(exportsField)) {
      return subpath === "." ? exportsField : undefined;
    }
    if (typeof exportsField !== "object" || exportsField === null) {
      return undefined;
    }
    const record = exportsField as Record<string, unknown>;
    const isSubpathMap = Object.keys(record).some(
      (key) => key === "." || key.startsWith("./"),
    );
    if (!isSubpathMap) {
      // Conditions object: the whole value is the `.` target.
      return subpath === "." ? exportsField : undefined;
    }
    if (
      Object.prototype.hasOwnProperty.call(record, subpath) &&
      !subpath.includes("*") &&
      !subpath.endsWith("/")
    ) {
      return record[subpath];
    }
    const patterns = Object.keys(record)
      .filter((key) => exportPatternReplacement(key, subpath) !== undefined)
      .sort(compareExportPatternKeys);
    if (patterns.length === 0) {
      return undefined;
    }
    const pattern = patterns[0]!;
    return substituteExportTarget(
      record[pattern],
      exportPatternReplacement(pattern, subpath)!,
    );
  }

  /** Capture the middle of one valid single-star exports key. */
  function exportPatternReplacement(
    pattern: string,
    subpath: string,
  ): string | undefined {
    const star = pattern.indexOf("*");
    if (
      !pattern.startsWith("./") ||
      star === -1 ||
      pattern.indexOf("*", star + 1) !== -1
    ) {
      return undefined;
    }
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (
      subpath.length < pattern.length ||
      !subpath.startsWith(prefix) ||
      !subpath.endsWith(suffix)
    ) {
      return undefined;
    }
    return subpath.slice(prefix.length, subpath.length - suffix.length);
  }

  /** Node exports patterns rank longer prefixes, then longer full keys, first. */
  function compareExportPatternKeys(left: string, right: string): number {
    const leftPrefix = left.indexOf("*");
    const rightPrefix = right.indexOf("*");
    if (leftPrefix !== rightPrefix) {
      return rightPrefix - leftPrefix;
    }
    return right.length - left.length;
  }

  /** Substitute the selected pattern capture into every string target branch. */
  function substituteExportTarget(
    target: unknown,
    replacement: string,
  ): unknown {
    if (typeof target === "string") {
      return target.split("*").join(replacement);
    }
    if (Array.isArray(target)) {
      return target.map((entry) => substituteExportTarget(entry, replacement));
    }
    if (typeof target !== "object" || target === null) {
      return target;
    }
    return Object.fromEntries(
      Object.entries(target).map(([condition, value]) => [
        condition,
        substituteExportTarget(value, replacement),
      ]),
    );
  }

  /** True when condition key `condition` appears anywhere in a (nested) target. */
  function containsCondition(target: unknown, condition: string): boolean {
    if (Array.isArray(target)) {
      return target.some((entry) => containsCondition(entry, condition));
    }
    if (typeof target !== "object" || target === null) {
      return false;
    }
    return Object.entries(target).some(
      ([key, value]) =>
        key === condition || containsCondition(value, condition),
    );
  }

  /**
   * Resolve a (possibly conditional) export target to a relative file string,
   * honouring `conditions` — a string is the target, an array is a fallback list,
   * an object picks the first key in the active condition set (package key order
   * wins, as Node does), and an explicit `null` blocks the target.
   */
  function resolveConditionalTarget(
    target: unknown,
    conditions: readonly string[],
  ): string | null {
    if (typeof target === "string") {
      return target;
    }
    if (target === null || target === undefined) {
      return null;
    }
    if (Array.isArray(target)) {
      for (const entry of target) {
        const resolved = resolveConditionalTarget(entry, conditions);
        if (resolved !== null) {
          return resolved;
        }
      }
      return null;
    }
    if (typeof target !== "object") {
      return null;
    }
    const active = new Set(conditions);
    for (const [key, value] of Object.entries(
      target as Record<string, unknown>,
    )) {
      if (active.has(key)) {
        const resolved = resolveConditionalTarget(value, conditions);
        if (resolved !== null) {
          return resolved;
        }
      }
    }
    return null;
  }

  /** `location` through its symlinks, or unchanged when it does not resolve. */
  export function resolveRealPath(location: string): string {
    try {
      return fs.realpathSync(location);
    } catch {
      return location;
    }
  }

  /**
   * Whether a plugin specifier is a relative path, including the Windows
   * backslash spellings a user may write in `tsconfig.json`.
   */
  export function isRelativePluginSpecifier(specifier: string): boolean {
    return (
      specifier === "." ||
      specifier === ".." ||
      specifier.startsWith("./") ||
      specifier.startsWith("../") ||
      specifier.startsWith(".\\") ||
      specifier.startsWith("..\\")
    );
  }
}
