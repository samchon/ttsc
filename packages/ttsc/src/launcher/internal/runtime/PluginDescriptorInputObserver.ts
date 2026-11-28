import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2ETrace } from "../../../internal/E2ETrace";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * Observe candidate and selected filesystem paths during isolated plugin
 * descriptor evaluation, producing the NDJSON records reported to the parent
 * loader.
 *
 * Within one synchronous resolution window (`createWindow`), ancestor
 * `lstatSync` queries and symlink-ancestor observations are shared across
 * sibling candidates so missing candidates do not walk from the filesystem root
 * on every probe. Missing candidates also skip redundant `statSync`,
 * `realpathSync.native`, and post-read signature walks because their absent
 * `lstatSync` already proves `hash = null` and `realpath = null`. Nothing is
 * retained across resolution windows: a subsequent resolution observes every
 * candidate and symlink ancestor afresh so mid-evaluation changes remain
 * detectable.
 *
 * @evidence contracts/common.md#principled-implementation Metadata signatures, content digests and physical targets are observed through native filesystem semantics; missing candidates carry their nearest existing ancestor's metadata, existing files bracket content and realpath reads with fresh before/after signatures, and symbolic-link ancestors are recorded separately so retargeting invalidates cache reuse.
 * @evidence contracts/common.md#clear-and-simple-design One internal namespace owns descriptor-input observation, window-local ancestor deduplication and injectable filesystem operations while installRuntimeHooks owns module resolution hooks and reporting channels.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unstable or unreadable observations record unstable=true rather than fabricating stability; nothing is shared across separate resolution windows, requirePresent checks still run on selected files, and production uses node:fs directly without monkey-patching globals.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state missing-path ancestor semantics, window-only sharing and absence of cross-resolution state; member comments describe each operation.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution, bigint lstat/stat and native realpath preserve platform link and case behavior without POSIX-only assumptions.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms Individual members state their traversal and syscall costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Individual members state what is shared per resolution window and dropped on return.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Individual members state window-local retention and immediate release.
 */
export namespace PluginDescriptorInputObserver {
  /**
   * Synchronous filesystem primitives used to observe descriptor inputs.
   * Production defaults directly to `node:fs`.
   *
   * @evidence contracts/common.md#principled-implementation Explicit filesystem operations preserve native lstat, stat, realpath and read semantics while allowing unit tests to count syscalls without replacing fs globals.
   * @evidence contracts/common.md#clear-and-simple-design Four minimal synchronous methods cover every metadata, physical-target and byte read the observer needs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Production omits this override and calls node:fs directly.
   * @evidence contracts/common.md#meaningful-documentation Member comments name the exact node:fs equivalent of each method.
   * @evidence contracts/portability.md#os-neutral-implementation Native paths pass unchanged to the underlying platform filesystem calls.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms An interface executes no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work An interface coordinates no caching.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources An interface retains no state or handles.
   */
  export interface FilesystemOperations {
    /** Native lstatSync supporting `{ bigint: true }`. */
    lstatSync: typeof fs.lstatSync;
    /** Native statSync supporting `{ bigint: true }`. */
    statSync: typeof fs.statSync;

    /**
     * Resolve a path to its physical target, as `fs.realpathSync.native` does.
     *
     * @evidence contracts/common.md#principled-implementation Native physical resolution records the link target that cache validation compares against on warm reuse.
     * @evidence contracts/common.md#clear-and-simple-design Single-argument synchronous signature matches fs.realpathSync.native directly.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Production uses native realpath and preserves non-UTF-8 paths with a physical identity witness.
     * @evidence contracts/common.md#meaningful-documentation Names the exact node:fs operation this member wraps.
     * @evidence contracts/portability.md#os-neutral-implementation Passes native paths unchanged to the platform realpath implementation.
     *
     * @evidenceExclude contracts/performance.md#efficient-algorithms This signature supplies physical-path lookup; the observer chooses when to call it.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The filesystem seam owns no cache.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous resolution retains no handle or population.
     */
    realpathSyncNative: (file: string) => string;

    /**
     * Read a regular file's bytes, or return undefined for a nonregular handle.
     *
     * @evidence contracts/common.md#principled-implementation Synchronous byte reads supply the exact file contents hashed into descriptor input proofs.
     * @evidence contracts/common.md#clear-and-simple-design The read seam returns the bytes or an unavailable marker.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Production uses a guarded native descriptor read without replacing fs globals.
     * @evidence contracts/common.md#meaningful-documentation Names the exact node:fs byte-read operation this member wraps.
     * @evidence contracts/portability.md#os-neutral-implementation Passes native file paths unchanged and returns unmodified bytes.
     *
     * @evidenceExclude contracts/performance.md#efficient-algorithms This signature supplies byte access; the observer chooses when to read.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The filesystem seam owns no cache.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous reads complete before returning and retain no handle.
     */
    readFileSync: (file: string) => Buffer | undefined;
  }

  /**
   * One input observation request carried into NDJSON reporting.
   *
   * @evidence contracts/common.md#principled-implementation Carries the resolved path plus any caller-supplied prior proof fields for contradiction checks.
   * @evidence contracts/common.md#clear-and-simple-design Matches the exact JSON wire shape consumed by readTtsxDescriptorInputs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional proof fields preserve contradictions rather than overwriting them.
   * @evidence contracts/common.md#meaningful-documentation Field names match the parent loader's protocol directly.
   * @evidence contracts/portability.md#os-neutral-implementation Paths remain native resolved strings.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms A record type executes no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A record type coordinates no caching.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A record type retains no resources.
   */
  export interface InputRecord {
    hash?: string | null;
    parent?: string;
    realpath?: string | null;
    resolved: string;
    signature?: string;
    specifier?: string;
    unstable?: boolean;
  }

  /**
   * Result of observing one path and any symbolic-link ancestors.
   *
   * @evidence contracts/common.md#principled-implementation Returns exact NDJSON report lines together with whether the requested path itself was absent on lstat.
   * @evidence contracts/common.md#clear-and-simple-design Two fields avoid re-parsing emitted JSON when callers only need to know whether a manifest candidate was absent.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Preserves missing versus present distinction directly from native lstat without guessing.
   * @evidence contracts/common.md#meaningful-documentation Field names state their observation meaning directly.
   * @evidence contracts/portability.md#os-neutral-implementation Contains platform-agnostic NDJSON lines and boolean absence status.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms A result record executes no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A result record coordinates no caching.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Caller owns the returned array; no resources are retained.
   */
  export interface ObservationResult {
    lines: string[];
    missing: boolean;
  }

  /**
   * One synchronous resolution-candidate observation window.
   *
   * @evidence contracts/common.md#principled-implementation Window-local ancestor observations serve one synchronous candidate expansion and are discarded on return.
   * @evidence contracts/common.md#clear-and-simple-design Exposes only candidate observation within the active resolution window.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Window state never survives past the resolution that created it.
   * @evidence contracts/common.md#meaningful-documentation States single-window scope.
   * @evidence contracts/portability.md#os-neutral-implementation Uses native resolved paths.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms Delegated to createWindow.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Delegated to createWindow.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Caller drops the window at resolution end.
   */
  export interface Window {
    /**
     * Observe one candidate path within this window.
     *
     * @evidence contracts/common.md#principled-implementation Takes a fresh lstatSync on the candidate itself, reuses window-local ancestor inspections for missing-ancestor and symlink-ancestor walks, and brackets existing-entry reads with fresh before/after metadata.
     * @evidence contracts/common.md#clear-and-simple-design Matches unbatched observe's signature while threading window-local ancestor and symlink maps internally.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Never skips the candidate's own lstatSync or requirePresent checks; broken or moving entries record unstable=true, and nothing persists past this window.
     * @evidence contracts/common.md#meaningful-documentation States single-window candidate observation behavior.
     * @evidence contracts/portability.md#os-neutral-implementation Uses native path resolution and ancestor splitting.
     * @evidence contracts/performance.md#efficient-algorithms Avoids repeated ancestor lstatSync and repeated symlink-ancestor observations across sibling candidates within the same resolution window.
     * @evidence contracts/performance.md#reuse-equivalent-work Shares ancestor lstatSync inspections and symlink-ancestor observations only across sibling calls on this Window instance and drops them when the caller drops the window.
     * @evidence contracts/performance.md#bound-retention-and-release-resources Window maps hold only distinct lexical ancestors touched during this synchronous resolution and are released when the caller drops the window.
     */
    observe(
      record: InputRecord,
      requirePresent?: boolean,
      onInvalid?: () => void,
    ): ObservationResult;
  }

  const DEFAULT_FS: FilesystemOperations = {
    lstatSync: fs.lstatSync,
    statSync: fs.statSync,
    realpathSyncNative: RuntimeFilesystem.realpathWitness,
    readFileSync: RuntimeFilesystem.readObservedRegularFile,
  };

  /** Stable public fingerprint for an existing directory candidate's kind. */
  const DIRECTORY_HASH = crypto
    .createHash("sha256")
    .update("ttsc:host-input:directory\0")
    .digest("hex");

  type PathInspection =
    | {
        readonly exists: true;
        readonly broken: false;
        readonly isDirectory: boolean;
        readonly isFile: boolean;
        readonly isSymlink: boolean;
        readonly metaSuffix: string;
      }
    | { readonly exists: true; readonly broken: true; readonly isSymlink: true }
    | { readonly exists: false; readonly error: boolean };

  interface WindowState {
    readonly ancestorInspections: Map<string, PathInspection>;
    readonly observedSymlinks: Set<string>;
  }

  /**
   * Create a single-resolution observation window backed by `operations`.
   *
   * @evidence contracts/common.md#principled-implementation Observes each candidate's metadata signature, content hash and physical target, plus symlink ancestors, marking unstable on any contradiction or read-window movement.
   * @evidence contracts/common.md#clear-and-simple-design Isolates window-local ancestor caches and injectable filesystem operations in one factory with no cross-resolution state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable or broken links fail closed as unstable rather than synthesizing valid signatures; existing entries always bracket reads with fresh before/after metadata, and nothing survives the window.
   * @evidence contracts/common.md#meaningful-documentation States factory purpose, single-window scope and default node:fs operations.
   * @evidence contracts/portability.md#os-neutral-implementation Native bigint lstat/stat and realpathSync.native preserve OS path and link identity.
   * @evidence contracts/performance.md#efficient-algorithms Each missing candidate incurs one fresh lstatSync on itself and reuses window-cached ancestor lstatSync results for both upward missing-ancestor lookup and downward symlink-ancestor discovery, with zero statSync or realpathSync.native calls on missing paths. Existing files reuse their pre-read target kind without an extra statSync, bracket readFileSync and realpathSync.native with fresh metadata, and each symlink ancestor is observed once per window.
   * @evidence contracts/performance.md#reuse-equivalent-work Window-local ancestor inspections and symlink-ancestor observations are shared only across sibling candidates of one synchronous resolution window and discarded when the window returns. Subsequent resolutions observe every candidate and symlink ancestor afresh.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Window maps are owned solely by the returned Window object, discarded when the resolution returns, and synchronous filesystem calls retain no handles.
   */
  export function createWindow(
    operations: Partial<FilesystemOperations> = {},
  ): Window {
    const ops = resolveOperations(operations);
    const windowState: WindowState = {
      ancestorInspections: new Map(),
      observedSymlinks: new Set(),
    };
    return {
      observe: (record, requirePresent = false, onInvalid) =>
        observePath(ops, record, requirePresent, onInvalid, windowState),
    };
  }

  /**
   * Observe one path and every symbolic link among its lexical ancestors
   * outside a resolution-candidate batch, with no shared ancestor state.
   *
   * @evidence contracts/common.md#principled-implementation Takes fresh metadata, content and realpath observations for the requested path and any symbolic-link ancestors, marking unstable on any contradiction or read-window movement.
   * @evidence contracts/common.md#clear-and-simple-design Shares the same native observation core as createWindow without allocating a cross-candidate cache.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Performs no cross-call reuse and never skips requirePresent checks on selected files.
   * @evidence contracts/common.md#meaningful-documentation States unbatched single-path observation semantics.
   * @evidence contracts/portability.md#os-neutral-implementation Uses native path resolution, bigint lstat/stat and native realpath.
   * @evidence contracts/performance.md#efficient-algorithms Skips redundant statSync, realpathSync.native and second upward walk on missing paths and avoids redundant isDirectory statSync on existing paths; performs one linear walk over lexical ancestors.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Single-path observation retains no cache and reuses no prior candidate observations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns caller-owned arrays and retains no state or handles.
   */
  export function observe(
    record: InputRecord,
    requirePresent: boolean = false,
    onInvalid?: () => void,
    operations: Partial<FilesystemOperations> = {},
  ): ObservationResult {
    return observePath(
      resolveOperations(operations),
      record,
      requirePresent,
      onInvalid,
      undefined,
    );
  }

  function resolveOperations(
    operations: Partial<FilesystemOperations>,
  ): FilesystemOperations {
    if (
      operations.lstatSync === undefined &&
      operations.statSync === undefined &&
      operations.realpathSyncNative === undefined &&
      operations.readFileSync === undefined
    ) {
      return DEFAULT_FS;
    }
    return {
      lstatSync: operations.lstatSync ?? DEFAULT_FS.lstatSync,
      statSync: operations.statSync ?? DEFAULT_FS.statSync,
      realpathSyncNative:
        operations.realpathSyncNative ?? DEFAULT_FS.realpathSyncNative,
      readFileSync: operations.readFileSync ?? DEFAULT_FS.readFileSync,
    };
  }

  function inspectPath(
    ops: FilesystemOperations,
    target: string,
    cache: Map<string, PathInspection> | undefined,
  ): PathInspection {
    if (cache !== undefined) {
      const cached = cache.get(target);
      if (cached !== undefined) return cached;
    }
    let result: PathInspection;
    try {
      const link = ops.lstatSync(target, { bigint: true });
      const isSymlink = link.isSymbolicLink();
      if (isSymlink) {
        let resolvedTarget: fs.BigIntStats;
        try {
          resolvedTarget = ops.statSync(target, { bigint: true });
        } catch {
          // A broken link's own metadata cannot expose its target appearing
          // and disappearing during evaluation. Decline cache proof instead.
          result = { exists: true, broken: true, isSymlink: true };
          cache?.set(target, result);
          return result;
        }
        result = {
          exists: true,
          broken: false,
          isDirectory: resolvedTarget.isDirectory(),
          isFile: resolvedTarget.isFile(),
          isSymlink: true,
          metaSuffix: formatMetadataSuffix(link, resolvedTarget),
        };
      } else {
        result = {
          exists: true,
          broken: false,
          isDirectory: link.isDirectory(),
          isFile: link.isFile(),
          isSymlink: false,
          metaSuffix: formatMetadataSuffix(link, link),
        };
      }
    } catch (error) {
      result = {
        exists: false,
        error: !RuntimeFilesystem.isMissingPathError(error),
      };
    }
    cache?.set(target, result);
    return result;
  }

  function observeMetadata(
    ops: FilesystemOperations,
    requested: string,
    ancestorCache: Map<string, PathInspection> | undefined,
    preObserved?: PathInspection,
  ): {
    exists: boolean;
    isDirectory: boolean;
    isFile?: boolean;
    missing: boolean;
    signature: string | undefined;
  } {
    // Always inspect the requested path itself fresh unless the caller just
    // inspected it in this same step (e.g. a symlink ancestor check).
    const own = preObserved ?? inspectPath(ops, requested, undefined);
    if (own.exists) {
      if (own.broken) {
        return {
          exists: true,
          isDirectory: false,
          missing: false,
          signature: undefined,
        };
      }
      return {
        exists: true,
        isDirectory: own.isDirectory,
        isFile: own.isFile,
        missing: false,
        signature: `${path.relative(requested, requested)}:${own.metaSuffix}`,
      };
    }
    if (own.error) {
      return {
        exists: false,
        isDirectory: false,
        missing: false,
        signature: undefined,
      };
    }
    let current = path.dirname(requested);
    if (current === requested) {
      return {
        exists: false,
        isDirectory: false,
        missing: true,
        signature: undefined,
      };
    }
    for (;;) {
      const ancestor = inspectPath(ops, current, ancestorCache);
      if (ancestor.exists) {
        if (ancestor.broken) {
          return {
            exists: false,
            isDirectory: false,
            missing: true,
            signature: undefined,
          };
        }
        return {
          exists: false,
          isDirectory: false,
          missing: true,
          signature: `${path.relative(current, requested)}:${ancestor.metaSuffix}`,
        };
      }
      if (ancestor.error) {
        return {
          exists: false,
          isDirectory: false,
          missing: true,
          signature: undefined,
        };
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return {
          exists: false,
          isDirectory: false,
          missing: true,
          signature: undefined,
        };
      }
      current = parent;
    }
  }

  function readContentHash(
    ops: FilesystemOperations,
    file: string,
  ): string | null {
    try {
      const content = ops.readFileSync(file);
      return content === undefined
        ? null
        : crypto.createHash("sha256").update(content).digest("hex");
    } catch {
      return null;
    }
  }

  function realpathOf(ops: FilesystemOperations, file: string): string | null {
    try {
      return ops.realpathSyncNative(file);
    } catch {
      return null;
    }
  }

  function observeOnce(
    ops: FilesystemOperations,
    record: InputRecord,
    requirePresent: boolean,
    ancestorCache: Map<string, PathInspection> | undefined,
    preObserved?: PathInspection,
  ): { line: string | undefined; missing: boolean } {
    try {
      const requested = path.resolve(record.resolved);
      const before = observeMetadata(
        ops,
        requested,
        ancestorCache,
        preObserved,
      );
      const beforeSignature = before.signature;
      let observedHash: string | null;
      let observedRealpath: string | null;
      let afterSignature: string | undefined;
      if (before.missing) {
        // lstatSync(requested) just reported ENOENT/ENOTDIR: neither content
        // nor physical target exists, so there is no content read to bracket.
        observedHash = null;
        observedRealpath = null;
        afterSignature = beforeSignature;
      } else if (before.exists && beforeSignature !== undefined) {
        observedHash = before.isDirectory
          ? DIRECTORY_HASH
          : before.isFile
            ? readContentHash(ops, requested)
            : null;
        observedRealpath = realpathOf(ops, requested);
        afterSignature = observeMetadata(ops, requested, undefined).signature;
      } else {
        // Broken symlink or non-missing stat error: already unstable.
        observedHash = null;
        observedRealpath = realpathOf(ops, requested);
        afterSignature = undefined;
      }
      const unstable =
        record.unstable === true ||
        (requirePresent &&
          (observedHash === null || observedRealpath === null)) ||
        beforeSignature === undefined ||
        afterSignature === undefined ||
        beforeSignature !== afterSignature ||
        (record.hash !== undefined && record.hash !== observedHash) ||
        (record.realpath !== undefined &&
          record.realpath !== observedRealpath) ||
        (record.signature !== undefined && record.signature !== afterSignature);
      // A missing path's signature is its nearest existing ancestor's metadata,
      // so a write anywhere in that ancestor refuses the proof; the trace names
      // which observation moved.
      if (unstable)
        E2ETrace.capabilityResolution("plugin-descriptor-input-unstable", {
          resolved: record.resolved,
          recordedSignature: record.signature,
          beforeSignature,
          afterSignature,
          hashChanged:
            record.hash !== undefined && record.hash !== observedHash,
        });
      return {
        line: `${JSON.stringify({
          ...record,
          hash: observedHash,
          realpath: observedRealpath,
          ...(unstable ? { unstable: true } : { signature: afterSignature }),
        })}\n`,
        missing: before.missing,
      };
    } catch {
      // Dependency reporting is advisory to cache reuse; the selected entry is
      // still retained by the parent if this side channel cannot observe it.
      return { line: undefined, missing: false };
    }
  }

  function observePath(
    ops: FilesystemOperations,
    record: InputRecord,
    requirePresent: boolean,
    onInvalid: (() => void) | undefined,
    windowState: WindowState | undefined,
  ): ObservationResult {
    const lines: string[] = [];
    const push = (result: {
      line: string | undefined;
      missing: boolean;
    }): boolean => {
      if (result.line !== undefined) {
        lines.push(result.line);
      } else {
        onInvalid?.();
      }
      return result.missing;
    };
    const resolved = path.resolve(record.resolved);
    const missing = push(
      observeOnce(
        ops,
        record,
        requirePresent,
        windowState?.ancestorInspections,
      ),
    );
    const parsed = path.parse(resolved);
    let current = parsed.root;
    const relative = path.relative(parsed.root, resolved);
    for (const segment of relative.split(path.sep).slice(0, -1)) {
      if (segment === "") continue;
      current = path.join(current, segment);
      const info = inspectPath(ops, current, windowState?.ancestorInspections);
      if (!info.exists) break;
      if (info.isSymlink) {
        if (windowState !== undefined) {
          if (windowState.observedSymlinks.has(current)) continue;
          windowState.observedSymlinks.add(current);
        }
        push(
          observeOnce(
            ops,
            { resolved: current },
            false,
            windowState?.ancestorInspections,
            info,
          ),
        );
      }
    }
    return { lines, missing };
  }

  function formatMetadataSuffix(
    link: fs.BigIntStats,
    target: fs.BigIntStats,
  ): string {
    return [
      link.dev,
      link.ino,
      link.mode,
      link.size,
      link.mtimeNs,
      link.ctimeNs,
      target.dev,
      target.ino,
      target.mode,
      target.size,
      target.mtimeNs,
      target.ctimeNs,
    ].join(":");
  }
}
