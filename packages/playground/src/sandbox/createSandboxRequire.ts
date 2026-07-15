// CJS-flavored sandbox `require` over an in-memory pack of `.js` / `.json`
// modules. Used by the playground Execute lane to run compiled JS in the
// browser without round-tripping through a CDN.
//
// Resolution algorithm (minimal):
//   - Bare specifier `typia/lib/X`:
//       try `typia/lib/X.js`, then `typia/lib/X/index.js`, then honor the
//       package's `exports` / `main` (read from <pkg>/package.json) before
//       giving up.
//   - Relative `./Y` / `../Y` (encountered when one pack module requires a
//       sibling): resolved against the caller's pack key.
//   - Bare `name` (no subpath): honors the package `main` field, falling back
//       to `name/index.js`.
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

  // Read package.json from pack and resolve via main/exports.
  const resolvePackageEntry = (
    pkg: string,
    subpath: string | null,
  ): string | null => {
    const pjKey = `${pkg}/package.json`;
    if (!has(pjKey)) return null;
    let pj: IPackJson;
    try {
      pj = JSON.parse(pack[pjKey]!) as IPackJson;
    } catch {
      return null;
    }
    if (subpath === null) {
      // bare "name": honor the root `exports` entry (string, subpath table
      // "." key, or bare condition map) → CJS target, else main, else index.
      const root = rootExportTarget(pj.exports);
      const r = pickConditionalExport(root);
      if (r) {
        const resolved = `${pkg}/${stripDotSlash(r)}`;
        return has(resolved) ? resolved : null;
      }
      if (typeof pj.main === "string") {
        return tryPaths(
          `${pkg}/${stripDotSlash(pj.main)}`,
          `${pkg}/${stripDotSlash(pj.main)}.js`,
          `${pkg}/${stripDotSlash(pj.main)}.cjs`,
          `${pkg}/${stripDotSlash(pj.main)}.mjs`,
          `${pkg}/${stripDotSlash(pj.main)}.json`,
          `${pkg}/${stripDotSlash(pj.main)}/index.js`,
          `${pkg}/${stripDotSlash(pj.main)}/index.cjs`,
        );
      }
      return tryPaths(`${pkg}/index.js`, `${pkg}/index.cjs`);
    }
    // Subpath: honor exports["./subpath"] or exports["./subpath/*"] patterns.
    const exportsAny = pj.exports;
    if (typeof exportsAny === "object" && exportsAny !== null) {
      const entries = exportsAny as Record<string, unknown>;
      // Exact match first.
      const exact = entries[`./${subpath}`];
      const ex = pickConditionalExport(exact);
      if (ex) {
        const resolved = `${pkg}/${stripDotSlash(ex)}`;
        if (has(resolved)) return resolved;
      }
      // Wildcard match.
      for (const [pattern, target] of Object.entries(entries)) {
        if (!pattern.endsWith("/*")) continue;
        const prefix = pattern.slice(2, -1); // strip "./" and trailing "*"
        if (!subpath.startsWith(prefix)) continue;
        const rest = subpath.slice(prefix.length);
        const targetStr = pickConditionalExport(target);
        if (!targetStr) continue;
        const resolved = `${pkg}/${stripDotSlash(targetStr.replace("*", rest))}`;
        if (has(resolved)) return resolved;
      }
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
      return tryPaths(
        joined,
        `${joined}.js`,
        `${joined}.cjs`,
        `${joined}.mjs`,
        `${joined}.json`,
        `${joined}/index.js`,
        `${joined}/index.cjs`,
      );
    }
    // Bare specifier. Split into package name + subpath.
    const { pkg, subpath } = splitBareSpecifier(specifier);
    if (subpath === null) {
      return resolvePackageEntry(pkg, null);
    }
    // First try direct paths (covers the common typia/lib/internal/X case).
    const direct = tryPaths(
      `${pkg}/${subpath}`,
      `${pkg}/${subpath}.js`,
      `${pkg}/${subpath}.cjs`,
      `${pkg}/${subpath}.mjs`,
      `${pkg}/${subpath}.json`,
      `${pkg}/${subpath}/index.js`,
      `${pkg}/${subpath}/index.cjs`,
    );
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
    if (key.endsWith(".json")) {
      mod.exports = JSON.parse(code) as unknown;
      return mod;
    }
    const localRequire = (specifier: string): unknown => {
      const resolved = resolveSpecifier(specifier, key);
      if (!resolved) {
        throw new Error(
          `require("${specifier}") is not available in the playground sandbox (from ${key})`,
        );
      }
      return evaluate(resolved).exports;
    };
    const filename = "/sandbox/" + key;
    const dir = "/sandbox/" + dirname(key);
    try {
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
    } catch (err) {
      // Surface eval-time errors with context so debugging the sandbox is
      // easier when typia ships a module that depends on something missing.
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`evaluating ${key}: ${message}`);
    }
    return mod;
  };

  return (specifier: string): unknown => {
    const resolved = resolveSpecifier(specifier, null);
    if (!resolved) {
      throw new Error(
        `require("${specifier}") is not available in the playground sandbox`,
      );
    }
    return evaluate(resolved).exports;
  };
}

/**
 * Reduce a `package.json` `exports` field to the value describing its ROOT
 * (".") entry, ready for {@link pickConditionalExport}. Node accepts three
 * valid root shapes and they must all resolve consistently:
 *
 *   - a bare string target — `"exports": "./index.cjs"`;
 *   - a subpath table keyed by "." — `{ ".": <target>, "./sub": ... }`;
 *   - a bare condition map whose keys are all conditions, not subpaths —
 *     `{ "require": "./index.cjs", "default": "./index.cjs" }`.
 *
 * Node forbids mixing subpath keys with condition keys, so the presence of any
 * "."-prefixed key decides the interpretation: a subpath table exposes its root
 * as `exports["."]`, while a condition map is itself the root target. Returns
 * null when `exports` is absent, empty, or describes no root entry.
 */
function rootExportTarget(exports: unknown): unknown {
  if (typeof exports === "string") return exports;
  if (!exports || typeof exports !== "object") return null;
  const obj = exports as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return null;
  const hasSubpathKey = keys.some((k) => k === "." || k.startsWith("./"));
  return hasSubpathKey ? obj["."] : obj;
}

function pickConditionalExport(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Prefer require (CJS) > default > node.
    const pick = obj.require ?? obj.default ?? obj.node;
    if (typeof pick === "string") return pick;
    if (pick && typeof pick === "object") return pickConditionalExport(pick);
  }
  return null;
}

function stripDotSlash(p: string): string {
  return p.startsWith("./") ? p.slice(2) : p;
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
