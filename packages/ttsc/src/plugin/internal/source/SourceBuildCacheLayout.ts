import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import type { ITtscSourceBuildCachePaths } from "./ITtscSourceBuildCachePaths";
import { pruneCacheFileRoot } from "./pruneCacheFileRoot";
import { pruneGoBuildCacheRoot } from "./pruneGoBuildCacheRoot";
import { prunePluginCacheRoot } from "./prunePluginCacheRoot";

/**
 * The layout of ttsc's source-plugin cache and the file operations its
 * maintenance shares.
 *
 * The default cache lives inside the workspace, at
 * `<workspaceRoot>/node_modules/.cache/ttsc`, so removing `node_modules` (or
 * the repository) reclaims the binaries and default Go objects stored there.
 * Dedicated or caller-owned Go cache overrides can live elsewhere.
 * This is the `find-cache-dir` convention (Babel, webpack, ESLint, Nuxt): a
 * disposable build cache under `node_modules/.cache/<tool>`. ttsc keeps no
 * automatic global (`~/.cache`) cache, because a machine-wide one would grow across tsgo
 * and plugin version bumps without an owner to reclaim it. See
 * `resolveSourceBuildCachePaths` for the override-then-workspace priority.
 *
 * @evidence contracts/common.md#principled-implementation Named cache parts separate compiled binaries, Go objects and serialized answers whose owners and retention policies differ.
 * @evidence contracts/common.md#clear-and-simple-design Shared path names and metadata primitives live together; each collector retains its own selection policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Directory and marker names define the persisted layout, and filesystem mutations use owned entries rather than patching foreign APIs.
 * @evidence contracts/common.md#meaningful-documentation Native prose locates the workspace cache and explains its disposable lifetime; public constant comments describe their payloads with separated members under the documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native path construction, directory-entry inspection and atomic rename are delegated to Node APIs; layout names are protocol components rather than platform separators.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups independently reviewed operations; it does not itself run a traversal.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Layout names do not establish computation identity or validity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace has no acquired state; its maintenance operations own reclamation decisions.
 */
export namespace SourceBuildCacheLayout {
  const DEFAULT_WORKSPACE_CACHE_MARKER = ".workspace-root";

  /** Directory name the workspace-local cache is placed under. */
  export const NODE_MODULES_DIRNAME = "node_modules";

  /** Directory name of ttsc's cache root below `node_modules/.cache`. */
  export const TTSC_CACHE_DIRNAME = "ttsc";

  /** Directory name of ttsc's own Go object cache inside the cache root. */
  export const GO_BUILD_CACHE_DIRNAME = "go-build";

  /** File inside a plugin cache entry recording when it was last used. */
  export const CACHE_LAST_USED_FILE = ".last-used";

  /** Directory of the descriptor evaluation answers inside the cache root. */
  export const DESCRIPTOR_CACHE_DIRNAME = "descriptors";

  /** Directory of the capability-resolution answers inside the cache root. */
  export const CAPABILITY_CACHE_DIRNAME = "capabilities";

  /** Directory of the ttsx runtime inside the cache root. */
  export const RUNTIME_CACHE_DIRNAME = "ttsx";

  /**
   * Directory inside a runtime cache directory that holds one directory per
   * prepared run, owned by the processes of that run.
   */
  export const RUNTIME_PROJECT_DIRNAME = "project";

  /** Directory of the lowered orphan sources inside the cache root. */
  export const ORPHAN_CACHE_DIRNAME = "ttsx-orphan";

  /**
   * The parts of the cache root whose entries are single files, each collected
   * by `pruneCacheFileRoot` and removed by `ttsc clean`.
   */
  export const CACHE_FILE_DIRNAMES: readonly string[] = [
    DESCRIPTOR_CACHE_DIRNAME,
    CAPABILITY_CACHE_DIRNAME,
    ORPHAN_CACHE_DIRNAME,
  ];

  /**
   * Run the opportunistic pruning of the plugin cache, of ttsc's Go object
   * cache, and of the single-file caches (`CACHE_FILE_DIRNAMES`), but only for
   * the default workspace-local location. A root the caller named through
   * `cacheDir` or `TTSC_CACHE_DIR` is theirs, and this opportunistic maintenance
   * skips it. Explicit clean requests follow the separate cleanup contract.
   *
   * @evidence contracts/common.md#principled-implementation Pruning is admitted only for an unoverridden workspace root, and Go objects are admitted only when their provenance is ttsc-cache.
   * @evidence contracts/common.md#clear-and-simple-design This ownership gate dispatches to dedicated binary, object and file collectors without duplicating their eviction policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Effective environment injection is a supported host boundary; explicit user-owned roots are deliberately protected.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain default-root ownership and why overrides suppress maintenance; prose and tags are visibly separated.
   * @evidence contracts/portability.md#os-neutral-implementation The gate reads injected environment values with Windows case-insensitive names and uses path-aware collector APIs without separator assumptions.
   * @evidence contracts/performance.md#efficient-algorithms A fixed ownership branch reads the injected environment; Windows name matching scans its keys and text. Admitted collectors perform size and age scans whose cost depends on retained entries.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This dispatch does not produce or validate a reusable computation result.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Default binary and answer roots are opportunistically reclaimed; explicit roots remain caller-owned and live Go leases can defer object collection.
   */
  export function maybePruneSourceBuildCaches(
    paths: ITtscSourceBuildCachePaths,
    cacheDir: string | undefined,
    env: NodeJS.ProcessEnv = process.env,
  ): void {
    // GC only the default (workspace-local) location. When the user pins an
    // explicit `cacheDir`/`TTSC_CACHE_DIR`, they own its lifetime, so ttsc must
    // not delete entries out from under them. `env` is the effective instance
    // environment so a programmatic caller that pins `TTSC_CACHE_DIR` only in
    // `context.env` is honored without leaning on the shared `process.env`.
    if (!cacheDir && !SidecarEnvironment.read(env, "TTSC_CACHE_DIR")) {
      prunePluginCacheRoot(paths.pluginRoot);
      if (paths.goBuildRootSource === "ttsc-cache") {
        pruneGoBuildCacheRoot(paths.goBuildRoot);
      }
      pruneCacheFiles(paths.root);
    }
  }

  /**
   * Apply the opportunistic collector to each single-file part
   * (`CACHE_FILE_DIRNAMES`) of `root`.
   *
   * @evidence contracts/common.md#principled-implementation Each declared answer-cache part receives the same single-file collector independently of binary and runtime directories; that owner decides interval admission, protection and tolerated deletion failure rather than this adapter guaranteeing reclamation.
   * @evidence contracts/common.md#clear-and-simple-design One loop over the layout's fixed part list centralizes maintenance dispatch.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The part list is the persisted layout contract, not a list of recognized projects or expected answers.
   * @evidence contracts/common.md#meaningful-documentation The native comment identifies the collected population and references the owning layout constant; tags follow a blank comment line.
   * @evidence contracts/portability.md#os-neutral-implementation path.join constructs native children; directory checks and deletion policy stay in the collector.
   * @evidence contracts/performance.md#efficient-algorithms Dispatch visits the fixed part list and constructs native child paths with work proportional to their text. Admitted collectors additionally pay their metadata/filename scans and optional entry sorts; payload population is not bounded by the part count.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A maintenance pass has filesystem effects and cannot be reused merely because it returns void.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each serialized-answer population receives age/size reclamation, with recent-use protection and failed deletes explicitly allowed to defer reclamation.
   */
  export function pruneCacheFiles(root: string): void {
    for (const name of CACHE_FILE_DIRNAMES)
      pruneCacheFileRoot(path.join(root, name));
  }

  /**
   * Record that `root` was selected as a default workspace-local cache root.
   *
   * The marker keeps an intentionally empty `node_modules` authoritative after
   * its first cache write changes its sole payload to `.cache/ttsc`. Creation
   * is exclusive so concurrent first writers never follow or replace an
   * existing filesystem entry. The selected root is pinned to its ordinary
   * physical spelling before publication; default writers use that returned
   * spelling for their payload too. Metadata checks do not hold a directory
   * handle that prevents concurrent replacement of the selected path.
   *
   * @evidence contracts/common.md#principled-implementation Current ordinary-root metadata and physical spelling precede exclusive marker creation, recording the selected installation boundary. The producer uses the returned spelling; continued root identity requires that the path not be concurrently replaced, rather than a retained directory-handle proof.
   * @evidence contracts/common.md#clear-and-simple-design Marker publication and existing-entry validation return one physical root for the caller's payload.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The marker represents an actual prior selection and is not fabricated workspace detection for particular consumers.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain first-write placement stability, current root validation and the path-replacement limit before exclusive marker publication.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat/realpath observe ordinary-root identity and Node's wx creation refuses an existing marker without OS-based case assumptions; these calls do not freeze parent-directory identity.
   * @evidence contracts/performance.md#efficient-algorithms Publication uses a fixed number of filesystem operations plus ordinary-root validation; recursive parent creation scales with missing path depth.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation persists installation provenance, not a computed answer whose inputs can be shared.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources At most one marker is retained per root and is reclaimed with that root; synchronous filesystem calls retain no open handle.
   */
  export function markDefaultWorkspaceCacheRoot(root: string): string {
    const physicalRoot = canonicalPluginCacheRoot(root);
    const marker = path.join(physicalRoot, DEFAULT_WORKSPACE_CACHE_MARKER);
    try {
      fs.writeFileSync(marker, "1\n", { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const stats = fs.lstatSync(marker);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw new Error(`ttsc: unsafe workspace cache marker: ${marker}`);
      }
    }
    return physicalRoot;
  }

  /**
   * Report whether one collected directory listing is empty or has a marker.
   *
   * An empty root is the state after root creation and before marker
   * publication. One listing avoids combining separate marker and emptiness
   * probes; it does not freeze directory contents or prove later ownership.
   *
   * @evidence contracts/common.md#principled-implementation Emptiness and ordinary-marker admission use the same collected Dirent list, avoiding separate observations. The result is placement evidence at that read, not an atomic filesystem snapshot or continuing ownership guarantee.
   * @evidence contracts/common.md#clear-and-simple-design Emptiness and marker recognition are derived from the same local array.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The marker is protocol provenance; no project name or fixture-specific filesystem shape is privileged.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains the concurrent publication interval that makes a single snapshot necessary.
   * @evidence contracts/portability.md#os-neutral-implementation Dirent type checks reject a symbolic marker using native filesystem facts instead of platform labels.
   * @evidence contracts/performance.md#efficient-algorithms One directory listing and linear marker search retain O(entries) references plus returned filename text; listing and equality costs include the visited names and native filesystem work, with no recursive payload traversal.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The current directory state is queried afresh because marker publication can change its answer.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This query retains no resource beyond its local directory snapshot.
   */
  export function isEmptyOrMarkedDefaultWorkspaceCacheRoot(
    root: string,
  ): boolean {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    if (entries.length === 0) return true;
    const marker = entries.find(
      (entry) => entry.name === DEFAULT_WORKSPACE_CACHE_MARKER,
    );
    return marker !== undefined && marker.isFile() && !marker.isSymbolicLink();
  }

  /**
   * Resolve the current default plugin cache to an ordinary physical spelling.
   * Missing root directories are created. Returned spelling avoids following
   * the caller's original ancestor alias again, but no retained directory handle
   * prevents later replacement of the physical path.
   *
   * @evidence contracts/common.md#principled-implementation lstat rejects an aliased leaf and realpath checks the current root against its observed physical parent. The returned spelling removes the original ancestor alias from later lookups, subject to path identity remaining stable after these non-atomic metadata observations.
   * @evidence contracts/common.md#clear-and-simple-design This boundary returns a physical spelling or throws; downstream collectors receive no partially validated path state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Filesystem identity comes from actual entry types and realpath rather than special-cased path strings.
   * @evidence contracts/common.md#meaningful-documentation Native prose states creation, current physical spelling and the absence of a directory-handle identity pin; the inline comment explains avoidance of the original ancestor alias.
   * @evidence contracts/portability.md#os-neutral-implementation Native realpath and lstat handle physical paths and links; textual equality here compares resolved parent spellings and does not infer volume case policy from an OS name.
   * @evidence contracts/performance.md#efficient-algorithms A fixed number of metadata operations performs validation, with path resolution and recursive creation dependent on ancestor depth.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Mutable aliases are validated per invocation rather than memoized without an invalidation witness.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This operation returns a path and retains no handles or root history. Created directories belong to the selected cache owner; their lifetime and eviction remain with that caller's cache policy.
   */
  export function canonicalPluginCacheRoot(root: string): string {
    fs.mkdirSync(root, { recursive: true });
    const physicalParent = fs.realpathSync.native(path.dirname(root));
    const stats = fs.lstatSync(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`ttsc: unsafe plugin cache root: ${root}`);
    }
    // Later lookups use this resolved spelling instead of the caller's original
    // ancestor alias; this is not a handle pin against physical-path replacement.
    const physicalRoot = fs.realpathSync.native(root);
    if (path.dirname(physicalRoot) !== physicalParent) {
      throw new Error(`ttsc: plugin cache root escaped its parent: ${root}`);
    }
    return physicalRoot;
  }

  /**
   * The millisecond timestamp a metadata file records, falling back to its
   * mtime when content reading fails or trimmed content is empty or nonfinite.
   * Returns `null` only when content supplies no timestamp and stat also fails.
   * Numeric text uses JavaScript Number conversion, without an integer, range
   * or decimal-only admission rule.
   *
   * @evidence contracts/common.md#principled-implementation Nonempty finite Number-convertible text supplies the timestamp; failed content reads, blank text and nonfinite values fall back to native mtime, and only failed stat after that absence yields null. This reader does not validate chronology or impose a numeric range.
   * @evidence contracts/common.md#clear-and-simple-design Content parsing and metadata fallback are two explicit stages with one nullable result.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Number parsing observes actual stored metadata; no known timestamps or cache keys receive special treatment.
   * @evidence contracts/common.md#meaningful-documentation Native documentation states timestamp units, the fallback and the unavailable outcome, separated from tags.
   * @evidence contracts/portability.md#os-neutral-implementation Node reads UTF-8 metadata and exposes mtimeMs consistently; no native date string or filesystem case convention is assumed.
   * @evidence contracts/performance.md#efficient-algorithms The synchronous read decodes the complete metadata, then trimming and Number conversion inspect its text, with temporary storage proportional to read bytes/text and at most one fallback stat. Supplied path work and native reads are additional costs; the reader enforces no metadata-size cap.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current timestamps change on hits and maintenance, so this reader does not cache its answer.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous reads leave no retained handle or history.
   */
  export function readTimestamp(file: string): number | null {
    try {
      const text = fs.readFileSync(file, "utf8").trim();
      const value = Number(text);
      if (text.length !== 0 && Number.isFinite(value)) {
        return value;
      }
    } catch {}
    try {
      return fs.statSync(file).mtimeMs;
    } catch {
      return null;
    }
  }

  /**
   * Replace cache metadata without following a pre-existing link or hard link.
   *
   * The caller supplies an owned, already selected parent directory. Replacing
   * its terminal entry does not authorize writes through an arbitrary parent.
   *
   * @evidence contracts/common.md#principled-implementation An exclusive sibling staging file is renamed over the target entry, preserving complete publication and avoiding writes through the old inode's aliases.
   * @evidence contracts/common.md#clear-and-simple-design Creation, publication and unconditional staging cleanup are contained in one try/finally.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Process identity and random bytes give independent sibling-name candidates, with exclusive creation refusing an occupied candidate; this is not a proof that names can never collide. Publication errors propagate rather than fabricate successful metadata.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish terminal-entry replacement from parent ownership, and inline prose explains why rename avoids alias mutation.
   * @evidence contracts/portability.md#os-neutral-implementation Same-directory rename and exclusive creation use Node's native semantics; failure on locked Windows entries propagates to the owner's policy.
   * @evidence contracts/performance.md#efficient-algorithms One contents write, one rename and one cleanup include supplied path/name and contents text work, plus fixed-size random sibling-name generation and native filesystem operations. The existing entry's contents are not copied.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each publication changes filesystem state and cannot be shared by equal return values.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Finally attempts removal of the staging candidate after success or failure, without retaining a handle or history. This assumes that independently chosen candidate belongs to this publication; cleanup errors can leave it for the owning cache collector, and no numeric bound on failed leftovers is established here.
   */
  export function replaceCacheMetadataFile(
    file: string,
    contents: string,
  ): void {
    const temporary = path.join(
      path.dirname(file),
      `.${path.basename(file)}.${process.pid}-${crypto
        .randomBytes(16)
        .toString("hex")}.tmp`,
    );
    try {
      fs.writeFileSync(temporary, contents, { encoding: "utf8", flag: "wx" });
      // rename replaces the directory entry itself. Unlike writeFile(file), it
      // cannot follow a symlink or mutate another hard link to the old inode.
      fs.renameSync(temporary, file);
    } finally {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {}
    }
  }
}
