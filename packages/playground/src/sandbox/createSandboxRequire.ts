// CJS-flavored sandbox `require` over an in-memory pack of `.js` / `.json`
// modules. Used by the playground Execute lane to run compiled JS in the
// browser without round-tripping through a CDN.
//
// Resolution algorithm (minimal):
//   - Bare specifier `typia/lib/X`:
//       honor the package's `exports` boundary when declared; otherwise try
//       `typia/lib/X.js`, then `typia/lib/X/index.js`.
//   - Relative `./Y` / `../Y` (encountered when one pack module requires a
//       sibling): resolved against the caller's pack key.
//   - Bare `name` (no subpath): honors package `exports`, then (only when
//       exports is absent) `main`, falling back to `name/index.js`.
//
// Every successful load is cached so cyclic graphs settle. Module evaluation
// wraps the source text in the standard CJS wrapper:
//   (function(require, module, exports, __dirname, __filename, console) {...})

interface IPackJson {
  name?: string;
  main?: string;
  exports?: unknown;
}

interface ISandboxRequireOptions {
  /** Console replacement injected into every sandbox module. */
  console:
    | Console
    | typeof globalThis.console
    | Record<string, (...args: unknown[]) => void>;
}

// The sandbox evaluates CommonJS through a `require` wrapper in a browser. It
// therefore activates `require`; `default` is always available as the portable
// fallback. `node` and `import` stay inactive because the sandbox supplies
// neither Node's runtime nor an ESM evaluator.
const ACTIVE_EXPORT_CONDITIONS = new Set(["require", "default"]);

type ExportTargetResolution =
  | { type: "resolved"; key: string }
  | { type: "blocked" }
  | { type: "unresolved" };

class InvalidPackageTargetError extends Error {}
class InvalidPackageTargetLoadError extends Error {}
class InvalidPackageConfigError extends Error {}

/**
 * Build a sandboxed `require` function over a runtime pack. Resolves typia /
 * `@typia/*` / randexp specifiers from the pack; throws on anything else so the
 * caller sees the unsupported dependency.
 */
export function createSandboxRequire(
  pack: Record<string, string>,
  opts: ISandboxRequireOptions,
): (specifier: string) => unknown {
  type ModuleObj = { exports: unknown };
  const cache = new Map<string, ModuleObj>();

  const has = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(pack, key);

  const tryPaths = (...candidates: string[]): string | null => {
    for (const c of candidates) if (has(c)) return c;
    return null;
  };

  const readPackageJson = (mount: string): IPackJson | null => {
    const key = `${mount}/package.json`;
    if (!has(key)) return null;
    try {
      const parsed = JSON.parse(pack[key]!) as unknown;
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("package.json must contain an object");
      }
      return parsed as IPackJson;
    } catch {
      throw new InvalidPackageConfigError(
        `invalid package configuration in ${key}`,
      );
    }
  };

  const packageDeclaresExports = (mount: string): boolean => {
    const manifest = readPackageJson(mount);
    return manifest?.exports !== null && manifest?.exports !== undefined;
  };

  const resolveLegacyFile = (candidate: string): string | null =>
    tryPaths(
      candidate,
      `${candidate}.js`,
      `${candidate}.cjs`,
      `${candidate}.mjs`,
      `${candidate}.json`,
    );

  const resolveLegacyIndex = (candidate: string): string | null =>
    tryPaths(
      `${candidate}/index.js`,
      `${candidate}/index.cjs`,
      `${candidate}/index.json`,
    );

  /** Resolve one legacy CommonJS file-or-directory candidate. */
  const resolveLegacyPath = (candidate: string): string | null => {
    const file = resolveLegacyFile(candidate);
    if (file !== null) return file;

    const manifest = readPackageJson(candidate);
    if (typeof manifest?.main === "string" && manifest.main.length !== 0) {
      const main = posixJoin(candidate, manifest.main);
      if (main !== candidate) {
        // Node's legacy tryPackage resolves the selected main as a file, then
        // as that directory's index. It does not recursively interpret a
        // second package.json below the selected main directory.
        const resolvedMain =
          resolveLegacyFile(main) ?? resolveLegacyIndex(main);
        if (resolvedMain !== null) return resolvedMain;
      }
    }
    return resolveLegacyIndex(candidate);
  };

  // Read package.json from pack and resolve via main/exports.
  const resolvePackageEntry = (
    mount: string,
    subpath: string | null,
  ): string | null => {
    const pj = readPackageJson(mount);
    if (pj?.exports !== null && pj?.exports !== undefined) {
      const resolution = resolvePackageExports(mount, pj.exports, subpath);
      return resolution.type === "resolved" ? resolution.key : null;
    }
    if (subpath === null) {
      return resolveLegacyPath(mount);
    }
    return null;
  };

  /**
   * Locate a package self-reference by walking from the calling module to its
   * nearest manifest. Node enables self-reference only when that manifest has
   * both the requested `name` and an `exports` field; the pack mount itself may
   * be an npm alias whose key differs from `name`.
   */
  const selfReferenceMount = (
    fromKey: string | null,
    requestedPackage: string,
  ): string | null => {
    if (fromKey === null) return null;
    const parts = dirname(fromKey).split("/").filter(Boolean);
    for (let length = parts.length; length > 0; --length) {
      const mount = parts.slice(0, length).join("/");
      const manifest = readPackageJson(mount);
      if (manifest === null) continue;
      return manifest.name === requestedPackage &&
        manifest.exports !== null &&
        manifest.exports !== undefined
        ? mount
        : null;
    }
    return null;
  };

  // Resolve a specifier (with optional `fromKey` for relative imports) to a
  // pack key, or null if unknown.
  const resolveSpecifier = (
    specifier: string,
    fromKey: string | null,
  ): string | null => {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      if (!fromKey) return null;
      const baseDir = dirname(fromKey);
      const joined = posixJoin(baseDir, specifier);
      return resolveLegacyPath(joined);
    }
    // Bare specifier. Split into package name + subpath.
    const { pkg, subpath } = splitBareSpecifier(specifier);
    const selfMount = selfReferenceMount(fromKey, pkg);
    if (selfMount !== null) {
      return resolvePackageEntry(selfMount, subpath);
    }
    if (subpath === null) {
      return resolvePackageEntry(pkg, null);
    }
    // A declared exports map is the public boundary. Only packages without one
    // retain the historical packed-file fallback.
    if (packageDeclaresExports(pkg)) return resolvePackageEntry(pkg, subpath);
    // First try direct paths (covers packages that do not declare exports).
    const direct = resolveLegacyPath(`${pkg}/${subpath}`);
    if (direct) return direct;
    // Fall back to package.json exports map.
    return resolvePackageEntry(pkg, subpath);
  };

  const evaluate = (key: string): ModuleObj => {
    const cached = cache.get(key);
    if (cached) return cached;
    const code = pack[key]!;
    const mod: ModuleObj = { exports: {} };
    // Cache before evaluation so cyclic requires see the partial exports.
    cache.set(key, mod);
    try {
      if (key.endsWith(".json")) {
        mod.exports = JSON.parse(code) as unknown;
        return mod;
      }
      const localRequire = (specifier: string): unknown => {
        const resolved = resolveSpecifier(specifier, key);
        if (!resolved || !has(resolved)) {
          throw new Error(
            `require("${specifier}") is not available in the playground sandbox (from ${key})`,
          );
        }
        return evaluate(resolved).exports;
      };
      const filename = "/sandbox/" + key;
      const dir = "/sandbox/" + dirname(key);
      const factory = new Function(
        "require",
        "module",
        "exports",
        "__dirname",
        "__filename",
        "console",
        code,
      ) as (
        req: (s: string) => unknown,
        m: ModuleObj,
        e: Record<string, unknown>,
        d: string,
        f: string,
        c: unknown,
      ) => void;
      factory(
        localRequire,
        mod,
        mod.exports as Record<string, unknown>,
        dir,
        filename,
        opts.console,
      );
      return mod;
    } catch (err) {
      // The entry is provisional until evaluation succeeds. Preserve a future
      // replacement rather than evicting by key alone.
      if (cache.get(key) === mod) {
        cache.delete(key);
      }
      // Surface eval-time errors with context so debugging the sandbox is
      // easier when typia ships a module that depends on something missing.
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`evaluating ${key}: ${message}`);
    }
  };

  return (specifier: string): unknown => {
    const resolved = resolveSpecifier(specifier, null);
    if (!resolved || !has(resolved)) {
      throw new Error(
        `require("${specifier}") is not available in the playground sandbox`,
      );
    }
    return evaluate(resolved).exports;
  };
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

/**
 * Resolve one package `exports` request without consulting pack existence.
 *
 * Node chooses one target first and performs file loading afterward. Keeping
 * those phases separate is essential: a valid first array target that names a
 * missing file must fail at load time rather than fall through to a later
 * target.
 */
function resolvePackageExports(
  mount: string,
  exportsField: unknown,
  subpath: string | null,
): ExportTargetResolution {
  let target: unknown;
  if (
    exportsField !== null &&
    typeof exportsField === "object" &&
    !Array.isArray(exportsField)
  ) {
    const entries = exportsField as Record<string, unknown>;
    const kind = classifyExportsObject(mount, entries);
    if (kind === "conditions") {
      if (subpath !== null) return { type: "unresolved" };
      target = entries;
    } else {
      const request = subpath === null ? "." : `./${subpath}`;
      if (
        Object.prototype.hasOwnProperty.call(entries, request) &&
        !request.includes("*") &&
        !request.endsWith("/")
      ) {
        target = entries[request];
      } else {
        const patterns = Object.entries(entries)
          .map(([pattern, candidate]) => ({
            pattern,
            replacement: exportPatternReplacement(pattern, request),
            target: candidate,
          }))
          .filter(
            (entry): entry is typeof entry & { replacement: string } =>
              entry.replacement !== undefined,
          )
          .sort((a, b) => compareExportPatternKeys(a.pattern, b.pattern));
        const selected = patterns[0];
        if (selected === undefined) return { type: "unresolved" };
        return resolvePackageTarget(
          mount,
          selected.target,
          selected.replacement,
        );
      }
    }
  } else {
    if (subpath !== null) return { type: "unresolved" };
    target = exportsField;
  }
  return resolvePackageTarget(mount, target, "");
}

/** Classify and validate a top-level exports object. */
function classifyExportsObject(
  mount: string,
  entries: Record<string, unknown>,
): "subpaths" | "conditions" {
  const keys = Object.keys(entries);
  const subpathKeys = keys.filter((key) => key.startsWith("."));
  if (subpathKeys.length !== 0 && subpathKeys.length !== keys.length) {
    throw new InvalidPackageConfigError(
      `invalid package configuration for ${mount}: exports cannot mix subpath and condition keys`,
    );
  }
  if (subpathKeys.length !== 0) {
    if (subpathKeys.some((key) => key !== "." && !key.startsWith("./"))) {
      throw new InvalidPackageConfigError(
        `invalid package configuration for ${mount}: invalid exports subpath key`,
      );
    }
    return "subpaths";
  }
  validateConditionKeys(mount, keys);
  return "conditions";
}

/** Resolve a string, array, conditional object, or null exports target. */
function resolvePackageTarget(
  mount: string,
  target: unknown,
  replacement: string,
): ExportTargetResolution {
  if (typeof target === "string") {
    const substituted = target.split("*").join(replacement);
    return {
      type: "resolved",
      key: resolvePackageTargetKey(mount, substituted),
    };
  }
  if (target === null) return { type: "blocked" };
  if (Array.isArray(target)) {
    if (target.length === 0) return { type: "blocked" };
    let lastInvalid: InvalidPackageTargetError | undefined;
    let lastBlocked = false;
    for (const candidate of target) {
      try {
        const resolution = resolvePackageTarget(mount, candidate, replacement);
        if (resolution.type === "blocked") {
          lastBlocked = true;
          lastInvalid = undefined;
        } else if (resolution.type === "resolved") {
          // File existence is a later phase and cannot trigger fallback.
          return resolution;
        }
      } catch (error) {
        if (!(error instanceof InvalidPackageTargetError)) throw error;
        lastInvalid = error;
        lastBlocked = false;
      }
    }
    if (lastInvalid !== undefined) throw lastInvalid;
    if (lastBlocked) return { type: "blocked" };
    return { type: "unresolved" };
  }
  if (target !== null && typeof target === "object") {
    const conditions = target as Record<string, unknown>;
    const keys = Object.keys(conditions);
    validateConditionKeys(mount, keys);
    for (const [condition, candidate] of Object.entries(conditions)) {
      if (!ACTIVE_EXPORT_CONDITIONS.has(condition)) continue;
      const resolution = resolvePackageTarget(mount, candidate, replacement);
      if (resolution.type === "unresolved") continue;
      return resolution;
    }
    return { type: "unresolved" };
  }
  throw new InvalidPackageTargetError(
    `invalid package target for ${mount}: expected a relative ./ target`,
  );
}

/** Reject integer-like condition keys, whose enumeration order is ambiguous. */
function validateConditionKeys(mount: string, keys: string[]): void {
  if (keys.some(isArrayIndexKey)) {
    throw new InvalidPackageConfigError(
      `invalid package configuration for ${mount}: numeric exports condition keys are not allowed`,
    );
  }
}

function isArrayIndexKey(key: string): boolean {
  if (!/^(?:0|[1-9]\d*)$/.test(key)) return false;
  const value = Number(key);
  return value >= 0 && value < 0xffffffff && String(value) === key;
}

/**
 * Resolve one URL-like package target into a normalized pack key.
 *
 * Targets are URL-like package-relative paths. Dot segments, `node_modules`,
 * and encoded path separators cannot escape or reinterpret the mount. URL
 * query/hash components do not participate in filesystem lookup, and pathname
 * percent escapes are decoded exactly once.
 */
function resolvePackageTargetKey(mount: string, target: string): string {
  if (!target.startsWith("./")) {
    throw new InvalidPackageTargetError(
      `invalid package target for ${mount}: ${JSON.stringify(target)}`,
    );
  }
  const pathnameTarget = target.split(/[?#]/, 1)[0]!;
  if (/%(?:2f|5c)/i.test(pathnameTarget)) {
    throw new InvalidPackageTargetLoadError(
      `invalid module specifier for ${mount}: ${JSON.stringify(target)}`,
    );
  }
  for (const rawSegment of pathnameTarget.slice(2).split(/[\\/]/)) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawSegment);
    } catch {
      throw new InvalidPackageTargetLoadError(
        `invalid module specifier for ${mount}: ${JSON.stringify(target)}`,
      );
    }
    const normalized = decoded.toLowerCase();
    if (
      normalized === "." ||
      normalized === ".." ||
      normalized === "node_modules" ||
      decoded.includes("/") ||
      decoded.includes("\\")
    ) {
      throw new InvalidPackageTargetError(
        `invalid package target for ${mount}: ${JSON.stringify(target)}`,
      );
    }
  }
  try {
    const base = new URL(`https://sandbox.invalid/${mount}/`);
    const resolved = new URL(target, base);
    const basePath = decodeURIComponent(base.pathname);
    const resolvedPath = decodeURIComponent(resolved.pathname).replace(
      /\/+/g,
      "/",
    );
    if (!resolvedPath.startsWith(basePath)) {
      throw new InvalidPackageTargetError(
        `invalid package target for ${mount}: ${JSON.stringify(target)}`,
      );
    }
    const relative = resolvedPath.slice(basePath.length);
    return `${mount}/${relative}`;
  } catch (error) {
    if (
      error instanceof InvalidPackageTargetError ||
      error instanceof InvalidPackageTargetLoadError
    )
      throw error;
    throw new InvalidPackageTargetLoadError(
      `invalid module specifier for ${mount}: ${JSON.stringify(target)}`,
    );
  }
}

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

function posixJoin(base: string, rel: string): string {
  const baseParts = base.split("/").filter(Boolean);
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") baseParts.pop();
    else baseParts.push(seg);
  }
  return baseParts.join("/");
}

function splitBareSpecifier(specifier: string): {
  pkg: string;
  subpath: string | null;
} {
  // Handle @scope/name[/subpath]
  if (specifier.startsWith("@")) {
    const slash1 = specifier.indexOf("/");
    if (slash1 < 0) return { pkg: specifier, subpath: null };
    const slash2 = specifier.indexOf("/", slash1 + 1);
    if (slash2 < 0) return { pkg: specifier, subpath: null };
    return {
      pkg: specifier.slice(0, slash2),
      subpath: specifier.slice(slash2 + 1),
    };
  }
  const slash = specifier.indexOf("/");
  if (slash < 0) return { pkg: specifier, subpath: null };
  return {
    pkg: specifier.slice(0, slash),
    subpath: specifier.slice(slash + 1),
  };
}
