import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import path from "node:path";

import { SidecarEnvironment } from "../compiler/internal/sharedHost/SidecarEnvironment";
import { PluginContentIdentities } from "../plugin/internal/source/PluginContentIdentities";

/**
 * Cache-key eligibility and observed module-graph proofs for startup preloads
 * carried in `NODE_OPTIONS`.
 *
 * Startup preloads run before ttsc's runtime hooks and descriptor recorder, so
 * arbitrary `NODE_OPTIONS` must refuse descriptor and capability caching. Only
 * `--require`/`-r` preloads whose exact physical paths appear in
 * `TTSC_CACHE_TRUSTED_PRELOADS` are accepted; `--import` and any other flag
 * refuse. Rather than analyzing syntax, ttsc observes each trusted preload's
 * live CommonJS module graph by walking `module.children` transitively from
 * `require.cache[rootPhysical]`, excluding Node builtins.
 *
 * Whoever lists a preload in `TTSC_CACHE_TRUSTED_PRELOADS` vouches for
 * everything it does beyond its module graph (reads, bindings, dlopen, branches
 * that depend on the environment). ttsc proves only which code the preload is,
 * by observing and digesting its module graph.
 *
 * @evidence contracts/common.md#principled-implementation Option tokenization reproduces Node's ParseNodeOptionsEnvVar rules, `-r` resolution anchors `createRequire` at the target cwd while refusing bare specifiers on `NODE_PATH` mismatch, trust requires exact physical paths in `TTSC_CACHE_TRUSTED_PRELOADS`, and `module.children` reachability isolates the user preload graph from ttsc's own modules.
 * @evidence contracts/common.md#clear-and-simple-design One internal namespace owns `NODE_OPTIONS` tokenization, trusted-root resolution, `require.cache` graph walking and metadata-backed digesting for all three caches and the descriptor evaluator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts `--import`, unknown flags, globs, untrusted paths, missing cache roots, unreadable graph files and empty graphs refuse caching rather than assuming an empty or safe graph.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why arbitrary `NODE_OPTIONS` refuse, the `--require`-only and observed-graph rules, and the exact residual trust boundary.
 * @evidence contracts/portability.md#os-neutral-implementation SidecarEnvironment reads `NODE_OPTIONS`, `NODE_PATH` and `TTSC_CACHE_TRUSTED_PRELOADS` with native variable-name identity; `path.delimiter` separates trusted physical paths and native realpath/stat/access observe regular files.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Members document tokenization, resolution, graph walk and metadata-backed digest costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Members define how PluginContentIdentities reuses preload file digests across processes.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no module-level state; records belong to PluginContentIdentities.
 */
export namespace TrustedNodeOptions {
  /**
   * Key part for `PluginDescriptorEvaluationCache.locate`, `""` when
   * `NODE_OPTIONS` is empty or whitespace, or `null` when caching must be
   * refused.
   *
   * Validates that `NODE_OPTIONS` contains only `--require`/`-r` flags whose
   * targets resolve from `props.cwd` to regular physical files listed verbatim
   * in `TTSC_CACHE_TRUSTED_PRELOADS`. The descriptor evaluator child separately
   * walks its own `require.cache` preload graph and records every file into
   * `evaluation.inputs`, `hostInputHashes` and `hostInputRealpaths` for
   * `PluginDescriptorEvaluationCache.read` to verify on every hit.
   *
   * Whoever lists a preload in `TTSC_CACHE_TRUSTED_PRELOADS` vouches for
   * everything it does beyond its module graph (reads, bindings, dlopen,
   * branches that depend on the environment). ttsc proves only which code the
   * preload is, by observing and digesting its module graph.
   *
   * @param props.cwd Working directory of the descriptor evaluator child.
   * @param props.env Effective environment of the descriptor evaluator child.
   * @evidence contracts/common.md#principled-implementation Empty `NODE_OPTIONS` returns an empty key part to preserve existing cache keys; non-empty options require trusted `--require`/`-r` roots resolved from the evaluator cwd and key the raw option text, trust list and resolved root paths.
   * @evidence contracts/common.md#clear-and-simple-design Shares option parsing and root resolution with the launcher key while leaving evaluation-time graph hashing to the descriptor evaluator child.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts `--import`, non-preload flags, globs, untrusted targets and bare `NODE_PATH` mismatches return null.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the empty-string, null and key-part meanings and explains why file content proofs belong to the evaluator child.
   * @evidence contracts/portability.md#os-neutral-implementation SidecarEnvironment handles native environment names, `path.delimiter` splits trusted paths, and `createRequire`/native realpath/stat resolve roots from the evaluator cwd.
   * @evidence contracts/performance.md#efficient-algorithms Tokenizes `NODE_OPTIONS` and resolves each trusted root without reading file contents; descriptor `read()` checks recorded file hashes on hits.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Pure key-part construction with no retained cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains no handles or module state.
   */
  export function descriptorKey(props: {
    /** Evaluator working directory used to resolve `-r` targets. */
    cwd: string;

    /** Complete child environment carrying `NODE_OPTIONS` and trust list. */
    env: NodeJS.ProcessEnv;
  }): string | null {
    const rawOptions = SidecarEnvironment.read(props.env, "NODE_OPTIONS");
    if (rawOptions === undefined || rawOptions.trim() === "") return "";

    const rawTrusted = SidecarEnvironment.read(props.env, TRUSTED_PRELOADS_ENV);
    if (rawTrusted === undefined || rawTrusted === "") return null;

    const roots = resolveTrustedRoots(props);
    if (roots === null || roots.length === 0) return null;
    return JSON.stringify([rawOptions, rawTrusted, roots]);
  }

  /**
   * Key part for the launcher's runtime-capability and capability-resolution
   * caches, `""` when `NODE_OPTIONS` is empty or whitespace, or `null` when
   * caching must be refused.
   *
   * Resolves every `--require`/`-r` in `NODE_OPTIONS` against `props.cwd`,
   * verifies exact membership in `TTSC_CACHE_TRUSTED_PRELOADS`, walks the
   * transitive `module.children` graph starting from each trusted root's
   * `Module` in `require.cache` (excluding builtins), and hashes every file in
   * that graph through `PluginContentIdentities.digest`. Any missing root in
   * `require.cache`, unreadable child, `--import`, or other flag refuses.
   *
   * Whoever lists a preload in `TTSC_CACHE_TRUSTED_PRELOADS` vouches for
   * everything it does beyond its module graph (reads, bindings, dlopen,
   * branches that depend on the environment). ttsc proves only which code the
   * preload is, by observing and digesting its module graph.
   *
   * @param props.cwd Working directory of the child process that receives
   *   `NODE_OPTIONS`, used to resolve `-r` targets as Node would.
   * @param props.env Effective environment of the child process.
   * @param props.identities Optional record store (or lazy opener) that proves
   *   unchanged preload-graph bytes from separable metadata across launches.
   * @param props.cache Optional `require.cache` map; defaults to this runtime's
   *   live CommonJS module cache.
   * @evidence contracts/common.md#principled-implementation Empty `NODE_OPTIONS` returns an empty key part; non-empty options require trusted `--require`/`-r` roots present in `require.cache`, a complete readable `module.children` graph, and SHA-256 digests of every graph file plus raw option and trust text.
   * @evidence contracts/common.md#clear-and-simple-design Composes root resolution, live graph walking and `PluginContentIdentities.digest` into one refuse-or-key decision shared by runtime-capability and capability-resolution caches.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing cache roots, unreadable children, empty graphs, `--import`, unknown flags and untrusted preloads return null rather than assuming an empty graph.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the empty-string, null and key-part meanings, the parameter roles and the exact residual trust contract.
   * @evidence contracts/portability.md#os-neutral-implementation SidecarEnvironment handles native variable-name identity, `path.delimiter` splits trusted paths, `createRequire` anchors `-r` resolution at `cwd`, and native realpath/stat/access identify regular files.
   * @evidence contracts/performance.md#efficient-algorithms Empty or refused options exit before opening a lazy store or reading bytes. Accepted graph files reuse digests from `PluginContentIdentities` via metadata stats on warm launches and hash full file bytes on cold or modified launches.
   * @evidence contracts/performance.md#reuse-equivalent-work Preload file digests are shared across processes under a dedicated `PluginContentIdentities` family with change-time separation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No handle or in-memory cache is retained; transient file reads close synchronously and identity records belong to `PluginContentIdentities`.
   */
  export function key(props: {
    /** Child working directory used to resolve `-r` targets. */
    cwd: string;

    /** Complete child environment carrying `NODE_OPTIONS` and trust list. */
    env: NodeJS.ProcessEnv;

    /** Optional record store (or lazy getter) proving preload-graph bytes. */
    identities?:
      | PluginContentIdentities.Store
      | (() => PluginContentIdentities.Store | undefined);

    /** Optional module cache map; defaults to the live `require.cache`. */
    cache?: NodeJS.Dict<NodeJS.Module>;
  }): string | null {
    const rawOptions = SidecarEnvironment.read(props.env, "NODE_OPTIONS");
    if (rawOptions === undefined || rawOptions.trim() === "") return "";

    const rawTrusted = SidecarEnvironment.read(props.env, TRUSTED_PRELOADS_ENV);
    if (rawTrusted === undefined || rawTrusted === "") return null;

    const roots = resolveTrustedRoots(props);
    if (roots === null || roots.length === 0) return null;

    const moduleCache =
      props.cache ??
      createRequire(path.join(path.resolve(props.cwd), "_.cjs")).cache;
    const graph = walkModuleGraph(roots, moduleCache);
    if (graph === null) return null;

    const store =
      typeof props.identities === "function"
        ? props.identities()
        : props.identities;
    const digests: Array<[string, string]> = [];
    for (const physical of graph) {
      const digest = preloadFileDigest(physical, store);
      if (digest === null) return null;
      digests.push([physical, digest]);
    }
    return JSON.stringify([rawOptions, rawTrusted, digests]);
  }

  /**
   * Resolve trusted `--require`/`-r` preload root physical paths for
   * `props.env` from `props.cwd`. Returns `[]` when `NODE_OPTIONS` is empty or
   * whitespace, `null` on refusal (`--import`, other flags, malformed quoting,
   * untrusted or unresolvable target, or `NODE_PATH` mismatch on a bare
   * specifier), or the ordered physical paths.
   *
   * @param props.cwd Working directory to resolve `-r` specifiers from.
   * @param props.env Environment carrying `NODE_OPTIONS`, `NODE_PATH` and
   *   `TTSC_CACHE_TRUSTED_PRELOADS`.
   * @evidence contracts/common.md#principled-implementation Anchors `createRequire` at `cwd` so package, relative and absolute `-r` specifiers resolve as Node resolves them; refuses bare specifiers when `NODE_PATH` differs from `process.env.NODE_PATH`, and requires `realpath`, `isFile` and exact membership in `TTSC_CACHE_TRUSTED_PRELOADS`.
   * @evidence contracts/common.md#clear-and-simple-design Shared by `descriptorKey`, `key` and the descriptor evaluator child so every boundary enforces identical flag and trust rules.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts `--import`, non-preload flags, globs, builtins, directories and untrusted files return null.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes the empty-array, null and physical-path outcomes.
   * @evidence contracts/portability.md#os-neutral-implementation SidecarEnvironment reads environment variables with native case identity, `path.delimiter` splits trusted paths, and native realpath/stat resolve regular files.
   * @evidence contracts/performance.md#efficient-algorithms Linear tokenization and one CJS resolution plus realpath/stat per `-r` option; no file bytes are read.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Pure observation over current arguments and filesystem state.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns a caller-owned array and retains nothing.
   */
  export function resolveTrustedRoots(props: {
    /** Working directory to resolve `-r` specifiers from. */
    cwd: string;

    /** Environment carrying `NODE_OPTIONS`, `NODE_PATH` and trust list. */
    env: NodeJS.ProcessEnv;
  }): string[] | null {
    const rawOptions = SidecarEnvironment.read(props.env, "NODE_OPTIONS");
    if (rawOptions === undefined || rawOptions.trim() === "") return [];

    const rawTrusted = SidecarEnvironment.read(props.env, TRUSTED_PRELOADS_ENV);
    if (rawTrusted === undefined || rawTrusted === "") return null;

    const tokens = parse(rawOptions);
    if (tokens === null || tokens.length === 0) return null;

    const targets = extractRequireTargets(tokens);
    if (targets === null || targets.length === 0) return null;

    const trusted = new Set(
      rawTrusted.split(path.delimiter).filter((entry) => entry.length > 0),
    );
    if (trusted.size === 0) return null;

    const resolvedCwd = path.resolve(props.cwd);
    const nodePathDiffers =
      (SidecarEnvironment.read(props.env, "NODE_PATH") ?? "") !==
      (SidecarEnvironment.read(process.env, "NODE_PATH") ?? "");
    const resolver = createRequire(path.join(resolvedCwd, "_.cjs"));
    const physicalPaths: string[] = [];
    for (const target of targets) {
      const physical = resolveRequirePhysicalPath(
        target,
        resolver,
        nodePathDiffers,
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
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing roots, non-regular or unreadable child filenames, malformed child entries and empty graphs return null instead of succeeding with an empty or partial graph.
   * @evidence contracts/common.md#meaningful-documentation Native prose states reachability isolation, cycle safety, builtin exclusion and every refusal condition.
   * @evidence contracts/portability.md#os-neutral-implementation Native `realpathSync.native`, `statSync` and `accessSync` verify each module's physical regular file without platform-specific path assumptions.
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
   * @evidence contracts/common.md#principled-implementation Follows Node's ParseNodeOptionsEnvVar state machine for ASCII whitespace, double quotes and in-string backslash escapes.
   * @evidence contracts/common.md#clear-and-simple-design Single linear pass with two booleans and no regex backtracking.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unterminated quotes and trailing escapes return null rather than repairing malformed options.
   * @evidence contracts/common.md#meaningful-documentation Native prose states whitespace, quoting, single-quote and backslash rules and the null return condition.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure string tokenizer over `NODE_OPTIONS` text with no filesystem, path or process calls; preserving unquoted backslashes keeps Windows paths intact across hosts.
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

  /** Environment variable listing exact trusted preload physical paths. */
  const TRUSTED_PRELOADS_ENV = "TTSC_CACHE_TRUSTED_PRELOADS";

  /** Dedicated `PluginContentIdentities` family for preload-graph files. */
  const PRELOAD_IDENTITY_KIND = "trusted-node-options-preload-graph-v1";

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

  /**
   * Return the SHA-256 content digest of `physical`, reusing a metadata-backed
   * `PluginContentIdentities` record while the file stays unchanged and
   * separable.
   */
  function preloadFileDigest(
    physical: string,
    store: PluginContentIdentities.Store | undefined,
  ): string | null {
    try {
      return PluginContentIdentities.digest(
        store,
        PRELOAD_IDENTITY_KIND,
        physical,
        (references) =>
          PluginContentIdentities.fileObservation(references, physical, true),
        () => {
          const stats = fs.statSync(physical, { bigint: true });
          if (!stats.isFile()) throw new Error("preload is not a regular file");
          const bytes = fs.readFileSync(physical);
          return crypto.createHash("sha256").update(bytes).digest("hex");
        },
      );
    } catch {
      return null;
    }
  }
}
