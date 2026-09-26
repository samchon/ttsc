import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { readJsonFile } from "../../../compiler/internal/project/readJsonFile";
import { isRelativePluginSpecifier } from "./isRelativePluginSpecifier";
import { moduleResolutionBaseSelects } from "./moduleResolutionBaseSelects";

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
   * `<name>/package.json`, then, for a package whose exports hide its manifest,
   * the manifest of the package directory Node resolved the package's entry
   * in.
   *
   * That directory is the `node_modules/<name>` of the first search root that
   * selects the entry (`moduleResolutionBaseSelects`), the rule every
   * resolution input of a load stops at. The manifest nearest the entry is not
   * it: a dual package keeps `dist/cjs/package.json` beside its CommonJS build,
   * and reading that one lost the package's own `ttsc` declaration, so a
   * hoisted plugin package of that shape was never discovered
   * (samchon/ttsc#1499).
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
      let entry: string;
      try {
        entry = projectRequire.resolve(name);
      } catch {
        return undefined;
      }
      for (const searchPath of projectRequire.resolve.paths(name) ?? []) {
        const directory = path.join(searchPath, ...name.split("/"));
        if (!moduleResolutionBaseSelects(directory, entry, [])) continue;
        const manifest = path.join(directory, "package.json");
        return existingFile(manifest) ? resolveRealPath(manifest) : undefined;
      }
      return undefined;
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
   * Resolve a bare plugin specifier under the dedicated `ttsc` export
   * condition.
   *
   * A package whose `.` entry is a runtime barrel (e.g. `typia`, whose index
   * re-exports the whole validator runtime) cannot serve as the plugin
   * descriptor entry: loading it during plugin bootstrap pulls the runtime in
   * and, for a self-hosting transform, forms a cycle. Such a package opts in by
   * adding a `ttsc` condition to its `exports` that points at a runtime-free
   * descriptor:
   *
   * "exports": { ".": { "ttsc": "./lib/transform.js", "default":
   * "./lib/index.js" } }
   *
   * The condition is honoured ONLY here, scoped to plugin-entry resolution. A
   * process-wide `--conditions=ttsc` would also redirect the package's normal
   * `import`s to the descriptor and break its runtime, so it must not be used.
   *
   * Returns `null` to fall back to the normal `require.resolve` when the
   * package does not opt in — no `exports`, or no `ttsc` branch for the
   * requested subpath — so such a package resolves exactly as it did before.
   * A package that opts in gets Node's answer for its target: the file it
   * selects, or the rejection Node would report for it.
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
    // From here the package has opted in, so Node's rules for the selected
    // target decide, and nothing falls back to the ordinary runtime entry: a
    // blocked (`null`) or unmatched target is not exported, an invalid target
    // is refused, and a selected file that is missing is not found. Falling
    // back would load the runtime barrel the package kept away from plugin
    // bootstrap, or a file Node itself would never resolve.
    const packageDir = path.dirname(packageJson);
    const file = resolvePackageTarget(
      target,
      new Set(PLUGIN_EXPORT_CONDITIONS),
      packageDir,
      packageJson,
    );
    if (file === null || file === undefined) {
      throw packageResolutionError(
        "ERR_PACKAGE_PATH_NOT_EXPORTED",
        `ttsc: package subpath "${split.subpath}" is not exported for plugin resolution by ${packageJson}`,
      );
    }
    if (!existingFile(file)) {
      throw packageResolutionError(
        "MODULE_NOT_FOUND",
        `ttsc: cannot find module ${file}, the plugin entry selected for "${specifier}" by ${packageJson}`,
      );
    }
    return resolveRealPath(file);
  }

  /**
   * Split a bare specifier into its package name and the `.`-prefixed subpath
   * it addresses (`"typia"` → `.`, `"typia/lib/transform"` → `./lib/transform`,
   * `"@scope/pkg/sub"` → `./sub`). Returns `null` for a relative/empty
   * specifier or a malformed scoped name.
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
   * Node's `PACKAGE_TARGET_RESOLVE` for an `exports` target whose pattern is
   * already substituted: the absolute file it selects, `null` when a matched
   * branch blocks it, or `undefined` when no branch matches.
   *
   * A string must be a `./` path whose segments name no `.`, `..`, or
   * `node_modules`, and must stay inside the package; anything else is an
   * invalid target. An object tries its keys in package order and returns the
   * first branch that matches, so a matched `null` ends the search instead of
   * falling through to `default`. An array returns its first matching entry,
   * passing over entries that are invalid or `null`, and ends with the last of
   * those outcomes.
   */
  function resolvePackageTarget(
    target: unknown,
    conditions: ReadonlySet<string>,
    packageDir: string,
    packageJson: string,
  ): string | null | undefined {
    if (typeof target === "string") {
      if (
        !target.startsWith("./") ||
        INVALID_TARGET_SEGMENT.test(target.slice(2))
      ) {
        throw invalidPackageTarget(target, packageJson);
      }
      const file = path.resolve(packageDir, target);
      if (isOutsideDirectory(packageDir, file)) {
        throw invalidPackageTarget(target, packageJson);
      }
      return file;
    }
    if (Array.isArray(target)) {
      if (target.length === 0) return null;
      let last: { error: unknown } | null | undefined;
      for (const entry of target) {
        let resolved: string | null | undefined;
        try {
          resolved = resolvePackageTarget(
            entry,
            conditions,
            packageDir,
            packageJson,
          );
        } catch (error) {
          if (!isInvalidPackageTarget(error)) throw error;
          last = { error };
          continue;
        }
        if (resolved === undefined) continue;
        if (resolved === null) {
          last = null;
          continue;
        }
        return resolved;
      }
      if (last === undefined || last === null) return last;
      throw last.error;
    }
    if (target === null) return null;
    if (typeof target === "object") {
      for (const [key, value] of Object.entries(
        target as Record<string, unknown>,
      )) {
        if (key !== "default" && !conditions.has(key)) continue;
        const resolved = resolvePackageTarget(
          value,
          conditions,
          packageDir,
          packageJson,
        );
        if (resolved !== undefined) return resolved;
      }
      return undefined;
    }
    throw invalidPackageTarget(String(target), packageJson);
  }

  /**
   * A path segment an `exports` target may not name: `.`, `..`, or
   * `node_modules`, each also percent-encoded, as Node's resolver rejects them.
   */
  const INVALID_TARGET_SEGMENT =
    /(^|\\|\/)((\.|%2e)(\.|%2e)?|(n|%6e|%4e)(o|%6f|%4f)(d|%64|%44)(e|%65|%45)(_|%5f)(m|%6d|%4d)(o|%6f|%4f)(d|%64|%44)(u|%75|%55)(l|%6c|%4c)(e|%65|%45)(s|%73|%53))(\\|\/|$)/i;

  function isOutsideDirectory(directory: string, file: string): boolean {
    const relative = path.relative(directory, file);
    return (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    );
  }

  function invalidPackageTarget(target: string, packageJson: string): Error {
    return packageResolutionError(
      "ERR_INVALID_PACKAGE_TARGET",
      `ttsc: invalid "exports" target ${JSON.stringify(target)} for plugin resolution in ${packageJson}`,
    );
  }

  function isInvalidPackageTarget(error: unknown): boolean {
    return (
      (error as { code?: unknown } | null)?.code ===
      "ERR_INVALID_PACKAGE_TARGET"
    );
  }

  /** An error carrying the code Node's resolver reports for the same case. */
  function packageResolutionError(code: string, message: string): Error {
    return Object.assign(new Error(message), { code });
  }

  /** `location` through its symlinks, or unchanged when it does not resolve. */
  export function resolveRealPath(location: string): string {
    try {
      return fs.realpathSync(location);
    } catch {
      return location;
    }
  }
}
