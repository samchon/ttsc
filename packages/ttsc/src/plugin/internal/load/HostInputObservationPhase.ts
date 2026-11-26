import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";

/**
 * Per-phase filesystem observation memo for host-input hashing and physical
 * path resolution.
 *
 * Within one synchronous load or verification phase, each candidate path is
 * observed with at most one `lstatSync`: an absent path (`ENOENT` or `ENOTDIR`)
 * answers both its content hash (`null`) and physical path (`null`), a present
 * non-symlink file hashes its bytes without a separate `statSync`, a present
 * non-symlink directory gets the fixed directory marker without reading
 * children, and a symlink follows native `statSync` and `realpathSync.native`.
 *
 * A descendant whose ancestor was already observed in the same phase as missing
 * (`ENOENT` or `ENOTDIR`) or as a non-symlink non-directory short-circuits to
 * `null` for both hash and realpath with zero syscalls. A symlink parent never
 * short-circuits its descendants. This relies on the same one-consistent-phase
 * premise as #1900's per-phase observation memo: sequential observations within
 * one synchronous phase are not an atomic snapshot, and the caller drops the
 * phase memo when that phase ends so later phases observe filesystem changes
 * afresh.
 *
 * For present non-symlink leaves, each ancestor directory is resolved once per
 * phase with `fs.realpathSync.native` and listed once per phase with
 * `fs.readdirSync` so the leaf keeps its exact on-disk spelling, byte-identical
 * to `fs.realpathSync.native` including case on case-insensitive volumes. Exact
 * entry matches resolve directly; case-folded matches apply only when both the
 * lexical name and the matched entry are entirely ASCII and unambiguous.
 * Symlink leaves, non-ASCII or ambiguous folds, and unreadable directory
 * listings fall back to `fs.realpathSync.native`.
 *
 * @evidence contracts/common.md#principled-implementation Absent paths map ENOENT and ENOTDIR from one lstat to null hash and null realpath; present files, directories and symlinks preserve exact content-hash and native physical-path semantics, only confirmed non-symlink non-directory or missing ancestors short-circuit descendants within one phase, and case folding applies only to unambiguous ASCII-to-ASCII matches.
 * @evidence contracts/common.md#clear-and-simple-design One phase owner coordinates lstat kind, content hashes, physical targets, ancestor realpaths and directory listings so hashHostInputPaths and realpathHostInputPaths share observations without duplicating filesystem rules.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Symlink parents never short-circuit descendants, lexical leaf basenames never replace on-disk spelling, non-ASCII or ambiguous folds and unreadable listings fall back to native realpathSync.native, and nothing is cached in module state across phases.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the lstat-sharing rule, absent-parent short-circuit boundary, one-consistent-phase premise, phase-end drop requirement and exact on-disk casing protocol.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.dirname/join/resolve, portable ENOENT/ENOTDIR classification, fs.lstatSync/statSync, fs.readdirSync and fs.realpathSync.native handle POSIX and Windows links, case-insensitive volumes and fallback spellings without platform-name branching.
 * @evidence contracts/performance.md#efficient-algorithms Each independent absent candidate incurs one lstatSync and zero statSync/realpath calls; descendants of already-observed missing or non-directory parents incur zero syscalls; present non-symlink files reuse their lstat kind and share one realpathSync.native and one readdirSync per parent directory per phase.
 * @evidence contracts/performance.md#reuse-equivalent-work Observations are shared only through an explicit caller-owned Phase instance within one synchronous load or verification phase and are dropped when that phase ends; separate phases observe the filesystem afresh.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Maps belong strictly to the caller-owned Phase object and are reclaimed when the phase ends; synchronous filesystem calls retain no open descriptors or global state.
 */
export namespace HostInputObservationPhase {
  const PHASE_BRAND = Symbol("ttsc.HostInputObservationPhase");

  const DIRECTORY_HASH = crypto
    .createHash("sha256")
    .update("ttsc:host-input:directory\0")
    .digest("hex");

  type LstatKind =
    | "missing"
    | "non-directory"
    | "directory"
    | "symlink"
    | "error";

  interface DirectoryListing {
    readonly exact: ReadonlySet<string>;
    readonly lower: ReadonlyMap<string, string | null>;
  }

  /**
   * Caller-owned observation state for one synchronous verification phase.
   *
   * Drop this object as soon as the phase ends; reusing it across a read,
   * resolution, subprocess, build, retry or yield would mask mutations.
   *
   * @evidence contracts/common.md#principled-implementation Holds exact per-phase lstat classifications, content hashes, physical targets and ancestor canonicalizations for one consistent phase.
   * @evidence contracts/common.md#clear-and-simple-design Groups all phase-scoped maps in one typed record branded against plain Map arguments.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Carries only observations made in this phase and never persists across loads.
   * @evidence contracts/common.md#meaningful-documentation Documents the caller's phase-end disposal requirement.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation A record type performs no native operation; namespace operations handle native boundaries.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A record type executes no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Reuse scope is defined by create and the observation operations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Owned by the caller for one synchronous phase.
   */
  export interface Phase {
    readonly [PHASE_BRAND]: true;
    readonly hashes: Map<string, string | null>;
    readonly realpaths: Map<string, string | null>;
    readonly lstats: Map<string, LstatKind>;
    readonly directoryRealpaths: Map<string, string | null>;
    readonly directoryEntries: Map<string, DirectoryListing | null>;
  }

  /**
   * Create an empty observation memo for one synchronous phase.
   *
   * @evidence contracts/common.md#principled-implementation Starts every phase with empty maps so no prior phase's filesystem observation leaks into the new phase.
   * @evidence contracts/common.md#clear-and-simple-design Single factory produces a branded Phase record.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Allocates fresh per-phase maps rather than returning shared module state.
   * @evidence contracts/common.md#meaningful-documentation States single-phase factory purpose.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Allocates JavaScript Maps with no native boundary.
   * @evidence contracts/performance.md#efficient-algorithms Constant-time allocation of five empty Maps.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Creates a fresh empty phase; sharing happens across calls given this instance.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Returned object is caller-owned and holds no handles.
   */
  export function create(): Phase {
    return {
      [PHASE_BRAND]: true,
      hashes: new Map(),
      realpaths: new Map(),
      lstats: new Map(),
      directoryRealpaths: new Map(),
      directoryEntries: new Map(),
    };
  }

  /**
   * Type guard distinguishing a {@link Phase} from a plain `Map` or legacy
   * hash/realpath map pair.
   *
   * @evidence contracts/common.md#principled-implementation Uses a private module symbol so arbitrary objects cannot masquerade as a Phase.
   * @evidence contracts/common.md#clear-and-simple-design One predicate lets mappers accept either a Phase or legacy Map cleanly.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Checks an unforgeable symbol brand rather than duck-typing Map properties.
   * @evidence contracts/common.md#meaningful-documentation States exact discrimination purpose.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure JavaScript symbol check.
   * @evidence contracts/performance.md#efficient-algorithms Constant-time property check.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Stateless type guard.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
   */
  export function isPhase(value: unknown): value is Phase {
    return (
      typeof value === "object" &&
      value !== null &&
      PHASE_BRAND in value &&
      (value as Phase)[PHASE_BRAND] === true
    );
  }

  /**
   * Observe and memoize the content hash of a resolved path within `phase`.
   *
   * @evidence contracts/common.md#principled-implementation Reuses one lstat per path: missing paths record null for both hash and realpath, non-symlink directories return the fixed directory digest, non-symlink files hash their bytes without an extra statSync, and symlinks follow statSync as before.
   * @evidence contracts/common.md#clear-and-simple-design Shares lstat classification and absent-parent short-circuiting with realpath observation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Follows symlinks with statSync rather than trusting link metadata, and returns null on unreadable paths without fabricating digests.
   * @evidence contracts/common.md#meaningful-documentation States resolved-path input and phase-scoped memoization.
   * @evidence contracts/portability.md#os-neutral-implementation Native fs.lstatSync, fs.statSync and fs.readFileSync handle host path and link semantics.
   * @evidence contracts/performance.md#efficient-algorithms Zero syscalls on repeat lookup or absent/non-directory ancestor hit; one lstatSync on independent absent paths and non-symlink directories; one lstatSync plus readFileSync on non-symlink files.
   * @evidence contracts/performance.md#reuse-equivalent-work Shares lstat and hash results within the caller-owned phase only.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Stores one hash string or null in phase.hashes; synchronous file reads close their descriptors before returning.
   */
  export function hash(resolved: string, phase: Phase): string | null {
    if (phase.hashes.has(resolved)) {
      return phase.hashes.get(resolved)!;
    }
    const kind = observeLstat(resolved, phase);
    if (kind === "missing") {
      return null;
    }
    let digest: string | null;
    if (kind === "directory") {
      digest = DIRECTORY_HASH;
    } else if (kind === "non-directory") {
      try {
        digest = crypto
          .createHash("sha256")
          .update(fs.readFileSync(resolved))
          .digest("hex");
      } catch {
        digest = null;
      }
    } else {
      try {
        if (fs.statSync(resolved).isDirectory()) {
          digest = DIRECTORY_HASH;
        } else {
          digest = crypto
            .createHash("sha256")
            .update(fs.readFileSync(resolved))
            .digest("hex");
        }
      } catch {
        digest = null;
      }
    }
    phase.hashes.set(resolved, digest);
    return digest;
  }

  /**
   * Observe and memoize the physical path of a resolved path within `phase`,
   * byte-identical to `fs.realpathSync.native`.
   *
   * @evidence contracts/common.md#principled-implementation Absent paths short-circuit to null from one lstat, symlink leaves resolve with native realpathSync.native, and non-symlink leaves join their cached physical parent directory with the exact on-disk entry name from a memoized readdirSync listing, falling back to realpathSync.native whenever the listing is unreadable or ambiguous.
   * @evidence contracts/common.md#clear-and-simple-design Shares lstat classification and absent-parent short-circuiting with hash observation while caching ancestor realpaths and directory listings per phase.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Never constructs a physical path from the lexical leaf basename; symlink leaves and unreadable or ambiguous listings always delegate to fs.realpathSync.native.
   * @evidence contracts/common.md#meaningful-documentation States byte-identical native realpath semantics and phase-scoped memoization.
   * @evidence contracts/portability.md#os-neutral-implementation Uses fs.realpathSync.native for ancestor canonicalization and symlink/fallback resolution and fs.readdirSync for exact on-disk leaf casing on case-insensitive volumes without platform-name assumptions.
   * @evidence contracts/performance.md#efficient-algorithms Zero syscalls on repeat lookup, already-observed absent path or absent/non-directory ancestor; present non-symlink files share one realpathSync.native and one readdirSync per parent directory per phase.
   * @evidence contracts/performance.md#reuse-equivalent-work Shares lstat, realpath, ancestor realpath and directory listing results only within the caller-owned phase.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Retained maps belong to the caller-owned Phase and are dropped when the phase ends; synchronous filesystem calls hold no open handles.
   */
  export function realpath(resolved: string, phase: Phase): string | null {
    if (phase.realpaths.has(resolved)) {
      return phase.realpaths.get(resolved)!;
    }
    const kind = observeLstat(resolved, phase);
    if (kind === "missing") {
      return null;
    }
    let target: string | null;
    if (kind === "symlink" || kind === "error") {
      target = nativeRealpath(resolved);
    } else if (kind === "directory") {
      target = resolveDirectoryRealpath(resolved, phase);
    } else {
      target = resolveNonSymlinkLeafRealpath(resolved, phase);
    }
    phase.realpaths.set(resolved, target);
    return target;
  }

  function observeLstat(resolved: string, phase: Phase): LstatKind {
    const existing = phase.lstats.get(resolved);
    if (existing !== undefined) {
      return existing;
    }
    if (hasAbsentOrNonDirectoryAncestor(resolved, phase)) {
      phase.lstats.set(resolved, "missing");
      phase.hashes.set(resolved, null);
      phase.realpaths.set(resolved, null);
      return "missing";
    }
    try {
      const stats = fs.lstatSync(resolved);
      const kind: LstatKind = stats.isSymbolicLink()
        ? "symlink"
        : stats.isDirectory()
          ? "directory"
          : "non-directory";
      phase.lstats.set(resolved, kind);
      return kind;
    } catch (error) {
      if (RuntimeFilesystem.isMissingPathError(error)) {
        phase.lstats.set(resolved, "missing");
        phase.hashes.set(resolved, null);
        phase.realpaths.set(resolved, null);
        return "missing";
      }
      phase.lstats.set(resolved, "error");
      return "error";
    }
  }

  /**
   * True only when a strict ancestor was already observed in this phase as
   * missing (`ENOENT`/`ENOTDIR`) or as a non-symlink non-directory. Symlink
   * parents never short-circuit descendants.
   */
  function hasAbsentOrNonDirectoryAncestor(
    resolved: string,
    phase: Phase,
  ): boolean {
    let current = path.dirname(resolved);
    while (current !== resolved) {
      const ancestor = phase.lstats.get(current);
      if (ancestor === "missing" || ancestor === "non-directory") {
        return true;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
    return false;
  }

  function resolveNonSymlinkLeafRealpath(
    resolved: string,
    phase: Phase,
  ): string | null {
    const parent = path.dirname(resolved);
    if (parent === resolved) {
      return nativeRealpath(resolved);
    }
    const physicalParent = resolveDirectoryRealpath(parent, phase);
    if (physicalParent === null) {
      return nativeRealpath(resolved);
    }
    const listing = listDirectory(physicalParent, phase);
    if (listing !== null) {
      const exactLeaf = lookupEntry(listing, path.basename(resolved));
      if (exactLeaf !== undefined) {
        return path.join(physicalParent, exactLeaf);
      }
    }
    return nativeRealpath(resolved);
  }

  function resolveDirectoryRealpath(
    directory: string,
    phase: Phase,
  ): string | null {
    if (phase.directoryRealpaths.has(directory)) {
      return phase.directoryRealpaths.get(directory)!;
    }
    const parent = path.dirname(directory);
    if (parent !== directory && phase.directoryRealpaths.has(parent)) {
      const physicalParent = phase.directoryRealpaths.get(parent);
      if (
        physicalParent !== null &&
        physicalParent !== undefined &&
        phase.directoryEntries.has(physicalParent)
      ) {
        const listing = phase.directoryEntries.get(physicalParent);
        if (listing !== null && listing !== undefined) {
          const kind = observeLstat(directory, phase);
          if (kind === "directory") {
            const exactName = lookupEntry(listing, path.basename(directory));
            if (exactName !== undefined) {
              const target = path.join(physicalParent, exactName);
              phase.directoryRealpaths.set(directory, target);
              return target;
            }
          }
        }
      }
    }
    const target = nativeRealpath(directory);
    phase.directoryRealpaths.set(directory, target);
    return target;
  }

  function listDirectory(
    physicalDirectory: string,
    phase: Phase,
  ): DirectoryListing | null {
    if (phase.directoryEntries.has(physicalDirectory)) {
      return phase.directoryEntries.get(physicalDirectory)!;
    }
    let names: string[];
    try {
      names = fs.readdirSync(physicalDirectory);
    } catch {
      phase.directoryEntries.set(physicalDirectory, null);
      return null;
    }
    const exact = new Set<string>(names);
    const lower = new Map<string, string | null>();
    for (const name of names) {
      const folded = name.toLowerCase();
      if (!isAscii(name) || lower.has(folded)) {
        lower.set(folded, null);
      } else {
        lower.set(folded, name);
      }
    }
    const listing: DirectoryListing = { exact, lower };
    phase.directoryEntries.set(physicalDirectory, listing);
    return listing;
  }

  function lookupEntry(
    listing: DirectoryListing,
    lexicalName: string,
  ): string | undefined {
    if (listing.exact.has(lexicalName)) {
      return lexicalName;
    }
    if (!isAscii(lexicalName)) {
      return undefined;
    }
    const folded = listing.lower.get(lexicalName.toLowerCase());
    return folded === undefined || folded === null ? undefined : folded;
  }

  function isAscii(value: string): boolean {
    for (let index = 0; index < value.length; index++) {
      if (value.charCodeAt(index) > 0x7f) return false;
    }
    return true;
  }

  function nativeRealpath(file: string): string | null {
    try {
      return fs.realpathSync.native(file);
    } catch {
      return null;
    }
  }
}
