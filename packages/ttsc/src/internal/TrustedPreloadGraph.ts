import fs from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import path from "node:path";

/**
 * Node-builtin-only `NODE_OPTIONS` option parsing, trusted-preload root
 * resolution, and live CommonJS `module.children` graph walking.
 *
 * The isolated CommonJS plugin descriptor evaluator requires this module only
 * when `NODE_OPTIONS` is non-empty, so it imports only Node builtins and never
 * pulls compiler or build-chain modules into a descriptor process. Callers pass
 * pre-read environment values using their own native environment-name rules.
 *
 * @evidence contracts/common.md#principled-implementation Option tokenization reproduces Node's ParseNodeOptionsEnvVar rules, `-r` resolution anchors `createRequire` at the target cwd while refusing bare specifiers on `NODE_PATH` mismatch, trust requires exact physical paths in the trust list, and `module.children` reachability isolates the preload graph from ttsc's own modules.
 * @evidence contracts/common.md#clear-and-simple-design One Node-builtin-only namespace owns `NODE_OPTIONS` tokenization, trusted-root resolution, and `require.cache` graph walking for both the CJS descriptor evaluator and `TrustedNodeOptions`.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts `--import`, unknown flags, globs, untrusted paths, missing cache roots, unreadable graph files, and empty graphs refuse caching rather than assuming an empty or safe graph.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the builtin-only boundary, why callers supply pre-read environment strings, and the exact refusal rules on each member.
 * @evidence contracts/portability.md#os-neutral-implementation Callers supply environment strings with native variable-name identity, `path.delimiter` separates trusted physical paths, and native realpath/stat/access observe regular files without platform-specific shell rules.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Members document tokenization, root resolution, and graph traversal complexity.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Pure functions over caller arguments and live `require.cache` state with no retained cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains no module-level state, handles, or `Module` references.
 */
export namespace TrustedPreloadGraph {
  /**
   * Resolve trusted `--require`/`-r` preload root physical paths from
   * `props.cwd` using caller-read environment values. Returns `[]` when
   * `props.rawOptions` is empty or whitespace, `null` on refusal (`--import`,
   * other flags, malformed quoting, untrusted or unresolvable target, or
   * `NODE_PATH` mismatch on a bare specifier), or the ordered physical paths.
   *
   * @param props.cwd Working directory to resolve `-r` specifiers from.
   * @param props.rawOptions Raw `NODE_OPTIONS` text for the target process.
   * @param props.rawTrusted Raw `TTSC_CACHE_TRUSTED_PRELOADS` list for the
   *   target process.
   * @param props.nodePathDiffers Whether the target process's `NODE_PATH`
   *   differs from this process's `NODE_PATH`.
   * @evidence contracts/common.md#principled-implementation Anchors `createRequire` at `cwd` so package, relative, and absolute `-r` specifiers resolve as Node resolves them; refuses bare specifiers when `nodePathDiffers` is true, and requires `realpath`, `isFile`, and exact membership in `rawTrusted`.
   * @evidence contracts/common.md#clear-and-simple-design Shared by `TrustedNodeOptions` and the CJS descriptor evaluator shim so every boundary enforces identical flag and trust rules without pulling `SidecarEnvironment` into the shim.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts `--import`, non-preload flags, globs, builtins, directories, and untrusted files return null.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes the empty-array, null, and physical-path outcomes and documents each input field.
   * @evidence contracts/portability.md#os-neutral-implementation Accepts caller-read native environment values, splits trusted paths with `path.delimiter`, recognizes Windows relative specifiers only on `win32`, and resolves regular files through native realpath and stat.
   * @evidence contracts/performance.md#efficient-algorithms Linear tokenization and one CJS resolution plus realpath/stat per `-r` option; no file bytes are read.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Pure observation over current arguments and filesystem state.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns a caller-owned array and retains nothing.
   */
  export function resolveTrustedRoots(props: {
    /** Working directory to resolve `-r` specifiers from. */
    cwd: string;

    /** Raw `NODE_OPTIONS` text for the target process. */
    rawOptions: string | undefined;

    /** Raw `TTSC_CACHE_TRUSTED_PRELOADS` list for the target process. */
    rawTrusted: string | undefined;

    /** Whether the target process's `NODE_PATH` differs from this process's. */
    nodePathDiffers: boolean;
  }): string[] | null {
    if (props.rawOptions === undefined || props.rawOptions.trim() === "")
      return [];

    if (props.rawTrusted === undefined || props.rawTrusted === "") return null;

    const tokens = parse(props.rawOptions);
    if (tokens === null || tokens.length === 0) return null;

    const targets = extractRequireTargets(tokens);
    if (targets === null || targets.length === 0) return null;

    const trusted = new Set(
      props.rawTrusted
        .split(path.delimiter)
        .filter((entry) => entry.length > 0),
    );
    if (trusted.size === 0) return null;

    const resolvedCwd = path.resolve(props.cwd);
    const resolver = createRequire(path.join(resolvedCwd, "_.cjs"));
    const physicalPaths: string[] = [];
    for (const target of targets) {
      const physical = resolveRequirePhysicalPath(
        target,
        resolver,
        props.nodePathDiffers,
      );
      if (physical === null || !trusted.has(physical)) return null;
      physicalPaths.push(physical);
    }
    return physicalPaths;
  }

  /**
   * Walk the transitive `module.children` graph starting from each trusted
   * root's `Module` in `cache[rootPhysical]`, deduplicating by `Module` object
   * and physical path, safe against cycles, and excluding Node builtins.
   *
   * Returns sorted physical paths of every reachable non-builtin module, or
   * `null` if any root is missing from `cache`, any reachable child lacks a
   * readable regular-file filename, or the resulting graph is empty.
   *
   * @param rootPhysicalPaths Ordered trusted preload root physical paths.
   * @param cache Optional `require.cache` map; defaults to this runtime's live
   *   CommonJS module cache.
   * @evidence contracts/common.md#principled-implementation Starting at `cache[rootPhysical]` and walking `module.children` transitively captures only modules loaded by the trusted preloads (including later lazy requires and cache hits), while excluding unrelated modules such as `runtimeHookPreload`.
   * @evidence contracts/common.md#clear-and-simple-design Iterative traversal deduplicating by both `Module` object identity and canonical physical path handles arbitrary cycles without recursion limits.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing roots, non-regular or unreadable child filenames, malformed child entries, and empty graphs return null instead of succeeding with an empty or partial graph.
   * @evidence contracts/common.md#meaningful-documentation Native prose states reachability isolation, cycle safety, builtin exclusion, and every refusal condition.
   * @evidence contracts/portability.md#os-neutral-implementation Native `realpathSync.native`, `statSync`, and `accessSync` verify each module's physical regular file without platform-specific path assumptions.
   * @evidence contracts/performance.md#efficient-algorithms Visits each reachable `Module` object once in O(V + E) plus one realpath/stat/access per unique non-builtin module, then sorts unique physical paths.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Walks the live module graph on demand to include lazy requires.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns a caller-owned sorted path array and retains no module references.
   */
  export function walkModuleGraph(
    rootPhysicalPaths: readonly string[],
    cache?: NodeJS.Dict<NodeJS.Module>,
  ): string[] | null {
    if (rootPhysicalPaths.length === 0) return null;
    const moduleCache = cache ?? createRequire(process.execPath).cache;
    const visitedModules = new Set<NodeJS.Module>();
    const physicalFiles = new Set<string>();
    const pending: NodeJS.Module[] = [];

    for (const rootPhysical of rootPhysicalPaths) {
      const rootModule = moduleCache[rootPhysical];
      if (rootModule === undefined || rootModule === null) return null;
      pending.push(rootModule);
    }

    while (pending.length !== 0) {
      const mod = pending.pop()!;
      if (visitedModules.has(mod)) continue;
      visitedModules.add(mod);

      if (isBuiltinModule(mod)) continue;
      if (typeof mod.filename !== "string" || !path.isAbsolute(mod.filename))
        return null;

      let physical: string;
      try {
        physical = fs.realpathSync.native(mod.filename);
        if (!fs.statSync(physical, { bigint: true }).isFile()) return null;
        fs.accessSync(physical, fs.constants.R_OK);
      } catch {
        return null;
      }
      physicalFiles.add(physical);

      if (!Array.isArray(mod.children)) return null;
      for (const child of mod.children) {
        if (child === null || typeof child !== "object") return null;
        if (!visitedModules.has(child)) pending.push(child);
      }
    }

    if (physicalFiles.size === 0) return null;
    return [...physicalFiles].sort();
  }

  /**
   * Tokenize a `NODE_OPTIONS` string using Node's `ParseNodeOptionsEnvVar`
   * rules, returning `null` on an unterminated double quote or trailing
   * escape.
   *
   * ASCII whitespace outside double quotes separates tokens. Double quotes
   * group characters and are stripped; single quotes are ordinary characters.
   * Backslash escapes the next character only inside double quotes and stays
   * literal outside quotes.
   *
   * @param text Raw `NODE_OPTIONS` value.
   * @evidence contracts/common.md#principled-implementation Follows Node's ParseNodeOptionsEnvVar state machine for ASCII whitespace, double quotes, and in-string backslash escapes.
   * @evidence contracts/common.md#clear-and-simple-design Single linear pass with two booleans and no regex backtracking.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unterminated quotes and trailing escapes return null rather than repairing malformed options.
   * @evidence contracts/common.md#meaningful-documentation Native prose states whitespace, quoting, single-quote, and backslash rules and the null return condition.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure string tokenizer over `NODE_OPTIONS` text with no filesystem, path, or process calls; preserving unquoted backslashes keeps Windows paths intact across hosts.
   * @evidence contracts/performance.md#efficient-algorithms Single O(N) scan over the N characters of text allocating only the resulting token array.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Pure function over a short option string with no shared work to coordinate.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns a caller-owned array and retains nothing.
   */
  export function parse(text: string): string[] | null {
    const args: string[] = [];
    let inString = false;
    let startNew = true;
    for (let index = 0; index < text.length; ++index) {
      let ch = text[index]!;
      if (ch === "\\" && inString) {
        if (index + 1 === text.length) return null;
        ch = text[++index]!;
      } else if (!inString && isAsciiWhitespace(ch)) {
        startNew = true;
        continue;
      } else if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (startNew) {
        args.push(ch);
        startNew = false;
      } else {
        args[args.length - 1] += ch;
      }
    }
    return inString ? null : args;
  }

  function isAsciiWhitespace(ch: string): boolean {
    return (
      ch === " " ||
      ch === "\t" ||
      ch === "\n" ||
      ch === "\r" ||
      ch === "\f" ||
      ch === "\v"
    );
  }

  /**
   * Extract `--require`/`-r` targets from parsed `NODE_OPTIONS` tokens;
   * `--import`, any other flag, or a missing/empty target refuses.
   */
  function extractRequireTargets(tokens: readonly string[]): string[] | null {
    const targets: string[] = [];
    for (let index = 0; index < tokens.length; ++index) {
      const token = tokens[index]!;
      if (token === "--require" || token === "-r") {
        const target = tokens[++index];
        if (target === undefined || target.length === 0) return null;
        targets.push(target);
      } else if (token.startsWith("--require=")) {
        const target = token.slice("--require=".length);
        if (target.length === 0) return null;
        targets.push(target);
      } else {
        return null;
      }
    }
    return targets;
  }

  function isRelativePathSpecifier(specifier: string): boolean {
    if (
      specifier === "." ||
      specifier === ".." ||
      specifier.startsWith("./") ||
      specifier.startsWith("../")
    )
      return true;
    return (
      process.platform === "win32" &&
      (specifier.startsWith(".\\") || specifier.startsWith("..\\"))
    );
  }

  /**
   * Resolve one `-r`/`--require` target via `resolver` (anchored at the target
   * cwd) and return its physical path when it names a regular file.
   */
  function resolveRequirePhysicalPath(
    target: string,
    resolver: NodeJS.Require,
    nodePathDiffers: boolean,
  ): string | null {
    try {
      const explicitPath =
        path.isAbsolute(target) || isRelativePathSpecifier(target);
      // Bare CJS specifiers consult the child's NODE_PATH, which can differ
      // from this parent process's Module.globalPaths.
      if (!explicitPath && nodePathDiffers) return null;
      const resolved = resolver.resolve(target);
      if (!path.isAbsolute(resolved)) return null;
      const physical = fs.realpathSync.native(resolved);
      const stats = fs.statSync(physical, { bigint: true });
      return stats.isFile() ? physical : null;
    } catch {
      return null;
    }
  }

  function isBuiltinModule(mod: NodeJS.Module): boolean {
    return (
      (typeof mod.id === "string" &&
        (mod.id.startsWith("node:") || isBuiltin(mod.id))) ||
      (typeof mod.filename === "string" &&
        (mod.filename.startsWith("node:") || isBuiltin(mod.filename)))
    );
  }
}
