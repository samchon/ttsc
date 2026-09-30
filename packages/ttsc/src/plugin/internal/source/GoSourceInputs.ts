import fs from "node:fs";
import path from "node:path";

/**
 * What of a Go source plugin, and of its toolchain, the build and the cache key
 * both see.
 *
 * The source walk and the cache key must agree on which files count, or an
 * irrelevant file would bust the cached binary (or a relevant one would not),
 * and the build must run with the same toolchain environment the key hashed.
 *
 * @evidence contracts/common.md#principled-implementation One policy defines real Go inputs, fixed artifact flags and local build residue so hashing, copying, compilation and observers agree about which changes affect the binary.
 * @evidence contracts/common.md#clear-and-simple-design Source-name predicates and invocation-environment construction are centralized for consumers instead of copying their policies across loaders and watchers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Omitted names are actual dependency/build residue boundaries; GOWORK and managed GOCACHE reflect the scratch build protocol rather than fixture-specific exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why residue is omitted and distinguish metadata probes from cache-writing builds; artifact-flag documentation identifies logical runtime source locations and unchanged embedded bytes.
 * @evidence contracts/portability.md#os-neutral-implementation Native roots use Node path APIs; platform sidecar names are omitted as residue without deriving filesystem capabilities from the running OS.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups input policies; each function owns its environment or membership processing.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Fixed policies are not retained computation; this namespace owns no runtime memo.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Policy collections have fixed population and do not own external resources.
 */
export namespace GoSourceInputs {
  /**
   * Artifact flags shared by native compilation and its environment identity.
   *
   * Go's trimpath removes disposable materialization paths from object keys
   * and debug information. Runtime source locations identify module files;
   * source diagnostics and embedded file contents still come from the snapshot.
   */
  export const BUILD_FLAGS: readonly string[] = Object.freeze(["-trimpath"]);

  /**
   * Names of directories that never contribute plugin source: a nested
   * `node_modules`, a repository's `.git`, and ttsc's own `.ttsc`. An observer
   * outside this package, such as `ttscserver`'s native host, is handed this
   * list rather than a copy of it (samchon/ttsc#1507).
   */
  export const PRUNED_SOURCE_DIRECTORY_NAMES: readonly string[] = [
    "node_modules",
    ".git",
    ".ttsc",
  ];

  const PRUNE_DIRS = new Set(PRUNED_SOURCE_DIRECTORY_NAMES);

  const GENERATED_WORKSPACE_FILES = new Set(["go.work", "go.work.sum"]);

  /**
   * The environment of a `go` invocation: `GOWORK=auto`, ttsc's own `GOCACHE`
   * when a cache root is given (only the real build writes it), and `GOROOT`
   * inferred from the binary's location when the environment does not set one.
   *
   * @evidence contracts/common.md#principled-implementation A copied environment receives the build's explicit workspace/cache settings and an inferred SDK root only when the caller did not supply one.
   * @evidence contracts/common.md#clear-and-simple-design One constructor serves build and metadata invocations; omitting the cache root intentionally keeps read-only probes separate from owned-cache writes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller's environment is preserved rather than mutating process globals, and documented Go variables express supported invocation policy.
   * @evidence contracts/common.md#meaningful-documentation Native prose states override precedence and why only actual builds receive managed GOCACHE; tags have separate presentation.
   * @evidence contracts/portability.md#os-neutral-implementation Native SDK inference delegates to path APIs, and Go's environment variables carry process configuration across supported operating systems.
   * @evidence contracts/performance.md#efficient-algorithms Copying E environment entries costs O(E) space/time and SDK inference performs a fixed number of path/existence operations.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation needs its effective environment copy; no retained computation is coordinated here.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only a call-local environment object is created.
   */
  export function goBuildEnv(
    goBinary: string,
    goBuildCacheRoot?: string,
    effectiveEnv: NodeJS.ProcessEnv = process.env,
  ): NodeJS.ProcessEnv {
    const env = { ...effectiveEnv };
    env.GOWORK = "auto";
    // Only the actual `go build` needs ttsc's GOCACHE; read-only metadata spawns
    // (`go mod edit`, `go env`, `go version`) call goBuildEnv with no cache root
    // and inherit the ambient GOCACHE, which they never write to anyway. GOCACHE
    // is not part of the plugin cache key, so this cannot affect it.
    if (goBuildCacheRoot) {
      env.GOCACHE = goBuildCacheRoot;
    }
    const goRoot = inferGoRoot(goBinary);
    if (goRoot && !env.GOROOT) {
      env.GOROOT = goRoot;
    }
    return env;
  }

  /**
   * The Go root of an absolute `<root>/bin/go` binary, verified by the presence
   * of `<root>/src/runtime`; `null` when the layout does not match.
   *
   * @evidence contracts/common.md#principled-implementation Only an absolute bin/go layout with an actual runtime source directory establishes the inferred SDK root; other layouts leave the caller's environment unchanged.
   * @evidence contracts/common.md#clear-and-simple-design Small early returns expose each required layout condition without a speculative toolchain-discovery abstraction.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Layout recognition uses the SDK's real structure, not a particular user's install path or expected test directory.
   * @evidence contracts/common.md#meaningful-documentation Native prose documents the recognized layout and null meaning rather than merely repeating the return type.
   * @evidence contracts/portability.md#os-neutral-implementation Node absolute/dirname/join operations use native path syntax; the Go SDK's bin and src/runtime components are distribution-defined names.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms Fixed path operations and one existence check do not choose a scaling workload algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Existence is checked for the current invocation rather than memoized independently of SDK changes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains no state or native handle.
   */
  export function inferGoRoot(goBinary: string): string | null {
    if (!path.isAbsolute(goBinary)) return null;
    const binDir = path.dirname(goBinary);
    if (path.basename(binDir) !== "bin") return null;
    const goRoot = path.dirname(binDir);
    return fs.existsSync(path.join(goRoot, "src", "runtime")) ? goRoot : null;
  }

  /**
   * Whether a directory never contributes plugin source: `node_modules`,
   * `.git`, and ttsc's own `.ttsc`.
   *
   * @evidence contracts/common.md#principled-implementation Exact membership in the shared residue-directory set makes every source consumer use the same omission rule.
   * @evidence contracts/common.md#clear-and-simple-design One predicate exposes policy without requiring walkers to duplicate its set.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts These names are package/repository/cache ownership boundaries, not consumer-specific source exclusions.
   * @evidence contracts/common.md#meaningful-documentation Native prose names the omitted directory categories, with a blank line before tags.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This name-membership predicate performs no native lookup or path interpretation.
   *
   * @evidence contracts/performance.md#efficient-algorithms A prebuilt set supplies expected constant-time membership for each traversed directory instead of rebuilding policy on every visit.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Static policy lookup does not coordinate a completed or in-flight computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The fixed module policy has constant population and owns no external resource.
   */
  export function shouldPruneDirectory(name: string): boolean {
    return PRUNE_DIRS.has(name);
  }

  /**
   * Names of files that are local build residue rather than plugin source:
   * generated workspace files and operating-system sidecars. They drift
   * independently of the Go source and would otherwise enter the cache key and
   * bust the cached binary on every unrelated editor or file-browser visit. An
   * observer that runs outside this package, such as `ttscserver`'s native
   * host, is handed this list rather than a copy of it (samchon/ttsc#1507).
   */
  export const OMITTED_SOURCE_FILE_NAMES: readonly string[] = [
    ...GENERATED_WORKSPACE_FILES,
    ".DS_Store",
    "Thumbs.db",
  ];

  /**
   * Suffixes of files that are local build residue rather than plugin source:
   * `npm pack` tarballs and editor backups ending in `~`.
   */
  export const OMITTED_SOURCE_FILE_SUFFIXES: readonly string[] = [
    ".tgz",
    ".tar.gz",
    "~",
  ];

  /**
   * Whether a file is local build residue rather than plugin source
   * (`OMITTED_SOURCE_FILE_NAMES`, `OMITTED_SOURCE_FILE_SUFFIXES`).
   *
   * @evidence contracts/common.md#principled-implementation Exact names and defined residue suffixes decide omission consistently for source digests, copies and observers.
   * @evidence contracts/common.md#clear-and-simple-design Shared name/suffix lists keep the complete file-residue policy visible to external observers and this predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The categories represent editor, archive and generated-workspace residue; they do not hide source files to satisfy known examples.
   * @evidence contracts/common.md#meaningful-documentation Native prose points to the documented categories rather than inventing an additional omission policy.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This string predicate does not interpret native path identity or access the filesystem.
   *
   * @evidence contracts/performance.md#efficient-algorithms The policy lists have fixed size; suffix comparison costs at most their total fixed suffix lengths, without traversing file contents.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Static policy lookup does not share runtime computation across requests.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only fixed policy constants are referenced.
   */
  export function shouldOmitSourceFile(name: string): boolean {
    return (
      OMITTED_SOURCE_FILE_NAMES.includes(name) ||
      OMITTED_SOURCE_FILE_SUFFIXES.some((suffix) => name.endsWith(suffix))
    );
  }
}
