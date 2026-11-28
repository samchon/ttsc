import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { SidecarEnvironment } from "../compiler/internal/sharedHost/SidecarEnvironment";
import { PluginContentIdentities } from "../plugin/internal/source/PluginContentIdentities";
import { TrustedPreloadGraph } from "./TrustedPreloadGraph";

/**
 * Cache-key eligibility and observed module-graph proofs for startup preloads
 * carried in `NODE_OPTIONS`.
 *
 * Startup preloads run before ttsc's runtime hooks and descriptor recorder, so
 * arbitrary `NODE_OPTIONS` must refuse descriptor and capability caching. Only
 * `--require`/`-r` preloads whose exact physical paths appear in
 * `TTSC_CACHE_TRUSTED_PRELOADS` are accepted; `--import` and any other flag
 * refuse. Rather than analyzing syntax, ttsc observes each trusted preload's
 * live CommonJS module graph through `TrustedPreloadGraph` by walking
 * `module.children` transitively from `require.cache[rootPhysical]`, excluding
 * Node builtins.
 *
 * List preloads whose files and resolution inputs stay stable while the
 * participating processes run. The caller also vouches for inputs outside the
 * observed graph, including filesystem reads and environment-dependent
 * effects.
 *
 * @evidence contracts/common.md#principled-implementation Environment variables are read with native name identity through SidecarEnvironment, root resolution and `module.children` graph walking delegate to TrustedPreloadGraph, and graph files are digested through PluginContentIdentities.
 * @evidence contracts/common.md#clear-and-simple-design Keeps cache-key construction and metadata-backed digesting here while delegating Node-builtin-only option parsing, root resolution, and graph walking to TrustedPreloadGraph.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts `--import`, unknown flags, globs, untrusted paths, missing cache roots, unreadable graph files, and empty graphs refuse caching rather than assuming an empty or safe graph.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why arbitrary `NODE_OPTIONS` refuse, the `--require`-only and observed-graph rules, and the exact residual trust boundary.
 * @evidence contracts/portability.md#os-neutral-implementation SidecarEnvironment reads `NODE_OPTIONS`, `NODE_PATH`, and `TTSC_CACHE_TRUSTED_PRELOADS` with native variable-name identity before delegating filesystem resolution and graph walking to TrustedPreloadGraph.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Members document key construction, graph delegation, and metadata-backed digest costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Members define how PluginContentIdentities reuses preload file digests across processes.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no module-level state; records belong to PluginContentIdentities.
 */
export namespace TrustedNodeOptions {
  /**
   * Key part for descriptor and capability caches, `""` with empty
   * `NODE_OPTIONS`, or `null` when reuse is unavailable.
   *
   * Resolves every `--require`/`-r` in `NODE_OPTIONS` against `props.cwd`,
   * verifies exact membership in `TTSC_CACHE_TRUSTED_PRELOADS`, walks the
   * transitive `module.children` graph starting from each trusted root's
   * `Module` in `require.cache` (excluding builtins), and hashes every file in
   * that graph through `PluginContentIdentities.digest`. A different child
   * `NODE_PATH` can redirect transitive imports even for an absolute root.
   * Match the child's absolute global search paths against the parent's
   * initialized CommonJS search paths. The parent's environment can change
   * after Node initializes them. Publication checks the child's startup graph.
   *
   * @param props.cwd Working directory of the child process that receives
   *   `NODE_OPTIONS`, used to resolve `-r` targets as Node would.
   * @param props.env Effective environment of the child process.
   * @param props.runtime Child executable, defaulting to the current Node.
   * @param props.identities Optional record store (or lazy opener) that proves
   *   unchanged preload-graph bytes from separable metadata across launches.
   * @param props.cache Optional `require.cache` map; defaults to this runtime's
   *   live CommonJS module cache.
   * @param props.expectedPreloadGraph Sorted paths from the descriptor child,
   *   supplied at publication.
   * @evidence contracts/common.md#principled-implementation Empty `NODE_OPTIONS` returns an empty key part; non-empty options read env values via SidecarEnvironment, resolve roots and walk `module.children` via TrustedPreloadGraph, and hash every graph file through PluginContentIdentities.
   * @evidence contracts/common.md#clear-and-simple-design Descriptor and capability caches share one root resolution, graph walk and file digest policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unproved graphs, untrusted flags and child graph or global module search mismatches refuse reuse.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the empty-string, null, and key-part meanings, the parameter roles, and the exact residual trust contract.
   * @evidence contracts/portability.md#os-neutral-implementation SidecarEnvironment handles native variable-name identity and TrustedPreloadGraph uses `path.delimiter`, `createRequire`, and native realpath/stat/access.
   * @evidence contracts/performance.md#efficient-algorithms Empty or refused options exit before opening a lazy store or reading bytes. Accepted graph files reuse digests from `PluginContentIdentities` via metadata stats on warm launches and hash full file bytes on cold or modified launches.
   * @evidence contracts/performance.md#reuse-equivalent-work Preload file digests are shared across processes under a dedicated `PluginContentIdentities` family with change-time separation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No handle or in-memory cache is retained; transient file reads close synchronously and identity records belong to `PluginContentIdentities`.
   */
  export function key(props: {
    /** Child working directory used to resolve `-r` targets. */
    cwd: string;

    /** Complete child environment carrying `NODE_OPTIONS` and trust list. */
    env: NodeJS.ProcessEnv;

    /** Executable whose startup would load the graph. */
    runtime?: string;

    /** Optional record store (or lazy getter) proving preload-graph bytes. */
    identities?:
      | PluginContentIdentities.Store
      | (() => PluginContentIdentities.Store | undefined);

    /** Optional module cache map; defaults to the live `require.cache`. */
    cache?: NodeJS.Dict<NodeJS.Module>;

    /** Sorted physical paths observed in the child at startup. */
    expectedPreloadGraph?: readonly unknown[];
  }): string | null {
    const rawOptions = SidecarEnvironment.read(props.env, "NODE_OPTIONS");
    if (rawOptions === undefined || rawOptions.trim() === "")
      return (props.expectedPreloadGraph?.length ?? 0) === 0 ? "" : null;

    const rawTrusted = SidecarEnvironment.read(props.env, TRUSTED_PRELOADS_ENV);
    if (rawTrusted === undefined || rawTrusted === "") return null;
    const searchPaths = matchingGlobalSearchPaths(
      props.env,
      props.runtime ?? process.execPath,
    );
    if (searchPaths === null) return null;

    const roots = TrustedPreloadGraph.resolveTrustedRoots({
      cwd: props.cwd,
      rawOptions,
      rawTrusted,
      nodePathDiffers: false,
    });
    if (roots === null || roots.length === 0) return null;

    const graph = TrustedPreloadGraph.walkModuleGraph(roots, props.cache);
    if (graph === null) return null;
    const expected = props.expectedPreloadGraph;
    if (
      expected !== undefined &&
      (expected.length !== graph.length ||
        graph.some((file, index) => file !== expected[index]))
    )
      return null;

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
    return JSON.stringify([
      rawOptions,
      rawTrusted,
      path.resolve(props.cwd),
      searchPaths,
      roots,
      digests,
    ]);
  }

  /** Environment variable listing exact trusted preload physical paths. */
  const TRUSTED_PRELOADS_ENV = "TTSC_CACHE_TRUSTED_PRELOADS";

  /** Dedicated `PluginContentIdentities` family for preload-graph files. */
  const PRELOAD_IDENTITY_KIND = "trusted-node-options-preload-graph-v1";

  /** Compare the child's startup inputs with the live CommonJS resolver. */
  function matchingGlobalSearchPaths(
    env: NodeJS.ProcessEnv,
    runtime: string,
  ): string[] | null {
    if (runtime !== process.execPath || process.release.name !== "node")
      return null;
    const windows = process.platform === "win32";
    const home = SidecarEnvironment.read(env, windows ? "USERPROFILE" : "HOME");
    const search = (SidecarEnvironment.read(env, "NODE_PATH") ?? "")
      .split(path.delimiter)
      .filter(Boolean);
    if (home) search.push(home);
    if (
      search.some(
        (entry) =>
          !path.isAbsolute(entry) ||
          (windows && path.parse(entry).root.length === 1),
      )
    )
      return null;
    if (home) {
      search.pop();
      search.push(path.resolve(home, ".node_modules"));
      search.push(path.resolve(home, ".node_libraries"));
    }
    const prefix = path.resolve(runtime, windows ? ".." : "../..");
    search.push(path.join(prefix, "lib", "node"));
    // A require anchored at the volume root has one local node_modules entry,
    // followed by the initialized global paths exposed by Node's resolver.
    const root = path.parse(runtime).root;
    const live = createRequire(path.join(root, "_.cjs")).resolve.paths("_");
    if (live === null || live.length !== search.length + 1) return null;
    return search.every((entry, index) => entry === live[index + 1])
      ? search
      : null;
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
