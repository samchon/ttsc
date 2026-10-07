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
 * Membership is ttsc's declared snapshot naming policy, not Go dependency
 * discovery. Excluded entries are neither copied nor hashed, even when Go could
 * embed them in the original package. File-backed plugin data must use names
 * and directories included by this policy. Generated workspace files belong to
 * the scratch build; the caller's excluded workspace bytes are not preserved.
 *
 * @evidence contracts/common.md#principled-implementation One policy defines the selected source snapshot and fixed artifact flags so hashing, copying and observers agree on its population; name exclusions do not establish which files a raw Go package could consume.
 * @evidence contracts/common.md#clear-and-simple-design Source-name predicates and invocation-environment construction are centralized for consumers instead of copying their policies across loaders and watchers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The declared naming exclusions apply uniformly to source consumers, including deliberately embedded data with matching names; GOWORK and managed GOCACHE express the scratch build protocol rather than fixture-specific exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish the snapshot naming policy from Go input discovery and describe excluded data and workspace ownership; invocation and artifact-flag prose explains their separate build responsibilities.
 * @evidence contracts/portability.md#os-neutral-implementation Native roots use Node path APIs; the same configured sidecar-name exclusions apply across platforms without deriving filesystem capabilities from the running OS.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups input policies; each function owns its environment or membership processing.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Fixed policies are not retained computation; this namespace owns no runtime memo.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Policy collections have fixed population and do not own external resources.
 */
export namespace GoSourceInputs {
  /**
   * Artifact flags shared by native compilation and its environment identity.
   *
   * Go's trimpath removes disposable materialization paths from object keys and
   * debug information. Runtime source locations identify module files; source
   * diagnostics and embedded file contents still come from the snapshot.
   */
  export const BUILD_FLAGS: readonly string[] = Object.freeze(["-trimpath"]);

  /**
   * Names of directories excluded below a plugin source root: a nested
   * `node_modules`, a repository's `.git`, and ttsc's own `.ttsc`. An observer
   * outside this package, such as `ttscserver`'s native host, is handed this
   * list rather than a copy of it.
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
   * when a cache root is given, and `GOROOT` inferred from the binary's
   * location when the copied environment's value is absent or empty. Build
   * callers supply the managed cache; metadata callers retain their ambient
   * GOCACHE.
   *
   * @evidence contracts/common.md#principled-implementation A copied environment receives explicit workspace/cache settings and an inferred SDK root only when its existing GOROOT value is absent or empty; nonempty caller values remain unchanged.
   * @evidence contracts/common.md#clear-and-simple-design One constructor serves build and metadata invocations; omitting the cache root intentionally keeps read-only probes separate from owned-cache writes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller's environment is preserved rather than mutating process globals, and documented Go variables express supported invocation policy.
   * @evidence contracts/common.md#meaningful-documentation Native prose states override precedence and why only actual builds receive managed GOCACHE; tags have separate presentation.
   * @evidence contracts/portability.md#os-neutral-implementation Native SDK inference delegates to path APIs, and Go's environment variables carry process configuration across supported operating systems.
   * @evidence contracts/performance.md#efficient-algorithms Environment enumeration copies E property references and processes key names; values are not deep-copied. SDK inference also performs native path-text construction and an existence query, whose filesystem/path costs are not bounded by E alone.
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
    // and inherit ambient GOCACHE rather than receiving the managed build
    // cache here. This constructor does not certify child-side effects.
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
   * Infer an SDK root for an absolute binary path inside `<root>/bin` when
   * `<root>/src/runtime` exists. The binary basename and runtime entry kind are
   * not validated here; `null` means this layout check did not match.
   *
   * @evidence contracts/common.md#principled-implementation An absolute binary path under bin and an existing src/runtime path establish this layout inference; the selected compiler's actual identity belongs to its resolution/probing owner, and other layouts leave the caller's environment unchanged.
   * @evidence contracts/common.md#clear-and-simple-design Small early returns expose each required layout condition without a speculative toolchain-discovery abstraction.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Layout recognition uses the SDK's real structure, not a particular user's install path or expected test directory.
   * @evidence contracts/common.md#meaningful-documentation Native prose documents the recognized layout and null meaning rather than merely repeating the return type.
   * @evidence contracts/portability.md#os-neutral-implementation Node absolute/dirname/join operations use native path syntax; the Go SDK's bin and src/runtime components are distribution-defined names.
   *
   * @evidence contracts/performance.md#efficient-algorithms A fixed sequence of native absolute/dirname/basename/join operations and one existence query checks the layout without enumerating a source tree. Path text and native lookup still contribute cost; fixed operation count is not a constant-byte filesystem bound.
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
   * Whether a directory is excluded from the source snapshot: `node_modules`,
   * `.git`, and `.ttsc`. Membership is by name, even for caller-owned data.
   *
   * @evidence contracts/common.md#principled-implementation Exact membership in the shared directory-name set makes every source consumer use the same snapshot omission rule.
   * @evidence contracts/common.md#clear-and-simple-design One predicate exposes policy without requiring walkers to duplicate its set.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts These are declared subtree exclusions, not a test of whether every matching directory is owned by a package manager, repository or cache.
   * @evidence contracts/common.md#meaningful-documentation Native prose names the omitted directory categories, with a blank line before tags.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This name-membership predicate performs no native lookup or path interpretation.
   *
   * @evidence contracts/performance.md#efficient-algorithms A prebuilt three-name set avoids rebuilding policy per directory; lookup still compares/hashes the supplied name under native JavaScript string/Set behavior and does not inspect directory content.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Static policy lookup does not coordinate a completed or in-flight computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The fixed module policy has constant population and owns no external resource.
   */
  export function shouldPruneDirectory(name: string): boolean {
    return PRUNE_DIRS.has(name);
  }

  /**
   * Names of files excluded from the snapshot: workspace files and names
   * commonly used for operating-system sidecars. Excluding them avoids key
   * changes on unrelated workspace or file-browser writes, but also excludes
   * caller-authored data with those names. An observer that runs outside this
   * package, such as `ttscserver`'s native host, is handed this list rather
   * than a copy of it.
   */
  export const OMITTED_SOURCE_FILE_NAMES: readonly string[] = [
    ...GENERATED_WORKSPACE_FILES,
    ".DS_Store",
    "Thumbs.db",
  ];

  /**
   * File suffixes excluded from the snapshot: archive names commonly produced
   * by `npm pack`, and backup names ending in `~`. These suffixes remain
   * excluded when the files hold deliberately authored plugin data.
   */
  export const OMITTED_SOURCE_FILE_SUFFIXES: readonly string[] = [
    ".tgz",
    ".tar.gz",
    "~",
  ];

  /**
   * Whether a file name is excluded from the source snapshot
   * (`OMITTED_SOURCE_FILE_NAMES`, `OMITTED_SOURCE_FILE_SUFFIXES`).
   *
   * @evidence contracts/common.md#principled-implementation Exact names and defined suffixes decide snapshot omission consistently for source digests, copies and observers, independently of Go embed directives.
   * @evidence contracts/common.md#clear-and-simple-design Shared name/suffix lists keep the complete file-exclusion policy visible to external observers and this predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The published name policy applies without inspecting file contents or treating matching embedded data as an exception; it does not claim all excluded files are irrelevant to Go.
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
