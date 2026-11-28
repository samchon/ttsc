import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";

/**
 * Per-phase filesystem observation memo for host-input hashing and physical
 * path resolution.
 *
 * Within one synchronous load or verification phase, each candidate path is
 * observed with at most one `lstatSync`. A native regular-file directory entry
 * can supply the same kind and spelling in a warm batch. An absent path
 * (`ENOENT` or `ENOTDIR`) answers both its content hash (`null`) and physical
 * path (`null`), a regular file hashes its guarded read without a separate path
 * `statSync`, a present non-symlink directory gets the fixed directory marker
 * without reading children, and a symlink follows native `statSync` and
 * `realpathSync.native`.
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
 * A few positive leaves resolve directly with `fs.realpathSync.native`. Larger
 * selections can share a physical parent and a directory scan bounded by the
 * number of known leaves. Exact matches can end the scan early. Recovering case
 * aliases requires a complete listing.
 *
 * @evidence contracts/common.md#principled-implementation Absent paths map ENOENT and ENOTDIR from one lstat to null hash and null realpath; present files, directories and symlinks preserve exact content-hash and native physical-path semantics, only confirmed non-symlink non-directory or missing ancestors short-circuit descendants within one phase, and case folding applies only to unambiguous ASCII-to-ASCII matches.
 * @evidence contracts/common.md#clear-and-simple-design One phase owner coordinates lstat kind, content hashes, physical targets, ancestor realpaths and directory listings so hashHostInputPaths and realpathHostInputPaths share observations without duplicating filesystem rules.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Symlink parents never short-circuit descendants, lexical leaf basenames never replace on-disk spelling, non-ASCII or ambiguous folds and unreadable listings fall back to native realpathSync.native, and nothing is cached in module state across phases.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the lstat-sharing rule, absent-parent short-circuit boundary, one-consistent-phase premise, phase-end drop requirement and exact on-disk casing protocol.
 * @evidence contracts/portability.md#os-neutral-implementation Native path and fs operations handle POSIX and Windows links, case aliases, lookup failures and directory streams. POSIX byte paths use lossless realpath witnesses and skip the string directory-listing shortcut.
 * @evidence contracts/performance.md#efficient-algorithms Absent paths reuse lstat and ancestor evidence. Sparse positive paths resolve directly. A batch shares parent realpath and scans at most four entries per known leaf plus a completeness probe before falling back.
 * @evidence contracts/performance.md#reuse-equivalent-work Observations are shared only through an explicit caller-owned Phase instance within one synchronous load or verification phase and are dropped when that phase ends; separate phases observe the filesystem afresh.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Phase maps keep the names of a completed listing or the bounded prefix containing every requested exact name. Exhausted and failed scans discard their entries. Open directory handles close before return.
 */
export namespace HostInputObservationPhase {
  const PHASE_BRAND = Symbol("ttsc.HostInputObservationPhase");

  // A listing pays off only when several observed leaves can share it.
  const MIN_SHARED_LEAVES = 3;
  const MIN_COLD_BATCH_LEAVES = MIN_SHARED_LEAVES * 2;
  const MAX_ENTRIES_PER_LEAF = 4;

  const DIRECTORY_HASH = crypto
    .createHash("sha256")
    .update("ttsc:host-input:directory\0")
    .digest("hex");

  type LstatKind =
    | "missing"
    | "non-directory"
    | "other"
    | "directory"
    | "symlink"
    | "error";

  interface DirectoryListing {
    readonly exact: ReadonlyMap<string, fs.Dirent>;
    readonly complete: boolean;
    lower?: ReadonlyMap<string, string | null>;
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
    readonly ordinaryLeaves: Map<string, string[]>;
  }

  /**
   * Create an empty observation memo for one synchronous phase.
   *
   * @evidence contracts/common.md#principled-implementation Starts every phase with empty maps so no prior phase's filesystem observation leaks into the new phase.
   * @evidence contracts/common.md#clear-and-simple-design Single factory produces a branded Phase record.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Allocates fresh per-phase maps rather than returning shared module state.
   * @evidence contracts/common.md#meaningful-documentation States single-phase factory purpose.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Allocates JavaScript Maps with no native boundary.
   * @evidence contracts/performance.md#efficient-algorithms Constant-time allocation of empty phase maps.
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
      ordinaryLeaves: new Map(),
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
   * @evidence contracts/performance.md#efficient-algorithms Zero syscalls on repeat lookup or absent/non-directory ancestor hit; one lstatSync on independent absent paths and non-symlink directories. A regular file has a guarded descriptor read, and a link first supplies the reached kind by stat.
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
        const content = RuntimeFilesystem.readObservedRegularFile(resolved);
        digest =
          content === undefined
            ? null
            : crypto.createHash("sha256").update(content).digest("hex");
      } catch {
        digest = null;
      }
    } else if (kind === "other") {
      digest = null;
    } else {
      try {
        const target = fs.statSync(resolved);
        if (target.isDirectory()) {
          digest = DIRECTORY_HASH;
        } else {
          const content = target.isFile()
            ? RuntimeFilesystem.readObservedRegularFile(resolved)
            : undefined;
          digest =
            content === undefined
              ? null
              : crypto.createHash("sha256").update(content).digest("hex");
        }
      } catch {
        digest = null;
      }
    }
    phase.hashes.set(resolved, digest);
    return digest;
  }

  /**
   * Observe and memoize the physical identity of a resolved path within
   * `phase`, preserving native realpath bytes when UTF-8 cannot carry them.
   *
   * @evidence contracts/common.md#principled-implementation Proved absences return null, native realpath resolves unqualified leaves, and a bounded listing supplies exact on-disk names. Resolving case aliases requires a complete listing.
   * @evidence contracts/common.md#clear-and-simple-design Shares lstat classification and absent-parent short-circuiting with hash observation while caching ancestor realpaths and directory listings per phase.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Never constructs a physical path from the lexical leaf basename; symlink leaves and unreadable or ambiguous listings always delegate to fs.realpathSync.native.
   * @evidence contracts/common.md#meaningful-documentation States byte-identical native realpath semantics and phase-scoped memoization.
   * @evidence contracts/portability.md#os-neutral-implementation Native canonicalization and directory entries preserve link behavior and physical spelling on each host.
   * @evidence contracts/performance.md#efficient-algorithms Repeated or proved-absent lookups issue no syscall; sparse positives use one native realpath after lstat, and shared parents have a listing budget proportional to observed leaves.
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

  /**
   * Start a warm proof's positive file observations together. The record
   * selects candidates for a bounded scan. Only an actual ordinary entry with
   * the exact spelling can replace an individual lstat and realpath.
   *
   * @evidence contracts/common.md#principled-implementation Recorded positive paths select directory batches. Native directory entries establish exact regular-file kind and spelling before any file bytes are hashed.
   * @evidence contracts/common.md#clear-and-simple-design Uses the phase's bounded scan and memo while leaving hashes and aliases to their existing observations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing, ambiguous, nonregular or unlisted entries retain individual native observation.
   * @evidence contracts/common.md#meaningful-documentation Names the profiling hint and the evidence that can replace per-file metadata calls.
   * @evidence contracts/portability.md#os-neutral-implementation Native dirents and parent realpath provide the filesystem spelling and kind.
   * @evidence contracts/performance.md#efficient-algorithms Groups recorded positives by their parents and scans only groups that meet the bounded-lane threshold. Each confirmed plain file saves an independent lstat.
   * @evidence contracts/performance.md#reuse-equivalent-work Later hash and realpath observations within this phase use the confirmed native entry.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Groups die with the call and the phase owns the bounded native observations until it settles.
   */
  export function observeRecordedFiles(
    recorded: Readonly<Record<string, string | null>>,
    hashes: Readonly<Record<string, string | null>>,
    phase: Phase,
  ): void {
    const groups = new Map<string, Map<string, string>>();
    for (const [input, target] of Object.entries(recorded)) {
      // A dirent does not prove that a child path can be searched. A prior
      // non-null hash requires a successful read before this batch can hit.
      if (target === null || typeof hashes[input] !== "string") continue;
      const file = path.resolve(input);
      if (phase.lstats.has(file)) continue;
      const name = path.basename(file);
      // A string dirent can decode an invalid native byte sequence to U+FFFD.
      if (name.includes("\ufffd")) continue;
      if (file !== target && name !== path.basename(target)) continue;
      const parent = path.dirname(file);
      let files = groups.get(parent);
      if (files === undefined) {
        files = new Map();
        groups.set(parent, files);
      }
      files.set(name, file);
    }
    for (const [parent, files] of groups) {
      if (
        files.size < MIN_SHARED_LEAVES ||
        hasAbsentOrNonDirectoryAncestor(parent, phase)
      )
        continue;
      const physical = resolveDirectoryRealpath(parent, phase);
      if (physical === null || physical.includes("\0")) continue;
      const listing = listDirectory(physical, [...files.keys()], phase);
      if (listing === null) continue;
      for (const [name, file] of files) {
        if (listing.exact.get(name)?.isFile() !== true) continue;
        phase.lstats.set(file, "non-directory");
        phase.realpaths.set(file, path.join(physical, name));
      }
    }
  }

  /**
   * Qualify exact siblings before individually hashing a fresh batch. A
   * successful guarded read is required to use a dirent as a paired content and
   * physical observation.
   *
   * @evidence contracts/common.md#principled-implementation A sufficiently large requested group nominates a bounded listing. An exact regular dirent and a successful guarded read establish its hash, kind and physical spelling in one phase.
   * @evidence contracts/common.md#clear-and-simple-design The batch hash caller provides the candidate population, and the phase owns all native observations and fallback state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Sparse, linked, unlisted and unreadable entries keep their individual native observations. Enumeration alone establishes no file's content or searchability.
   * @evidence contracts/common.md#meaningful-documentation Describes the fresh phase and the successful read requirement.
   * @evidence contracts/portability.md#os-neutral-implementation Native dirents and lossless physical parent identity establish exact spelling. Potentially lossy names bypass the listing shortcut.
   * @evidence contracts/performance.md#efficient-algorithms Groups distinct candidate names by parent, skips sparse groups and uses the same bounded scanner as individual realpath observations. Confirmed reads omit per-file lstat and realpath calls.
   * @evidence contracts/performance.md#reuse-equivalent-work Fresh phases alone plan batches. Warm or partially observed phases keep their existing observations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Grouping is call-local, and the scanner closes before file reads. Only observations survive in the caller's phase.
   */
  export function hashKnownFiles(files: readonly string[], phase: Phase): void {
    if (
      files.length < MIN_COLD_BATCH_LEAVES ||
      phase.lstats.size !== 0 ||
      phase.hashes.size !== 0 ||
      phase.realpaths.size !== 0
    )
      return;
    const groups = new Map<string, Set<string>>();
    for (const file of files) {
      const resolved = path.resolve(file);
      const name = path.basename(resolved);
      if (name.includes("\ufffd")) continue;
      const parent = path.dirname(resolved);
      const names = groups.get(parent);
      if (names === undefined) groups.set(parent, new Set([name]));
      else names.add(name);
    }
    for (const [parent, names] of groups) {
      if (names.size < MIN_COLD_BATCH_LEAVES) continue;
      const physical = resolveDirectoryRealpath(parent, phase);
      if (physical === null || physical.includes("\0")) continue;
      const listing = listDirectory(physical, [...names], phase);
      if (listing === null) continue;
      for (const name of names) {
        if (listing.exact.get(name)?.isFile() !== true) continue;
        const file = path.join(parent, name);
        try {
          const content = RuntimeFilesystem.readObservedRegularFile(file);
          if (content === undefined) continue;
          const digest = crypto
            .createHash("sha256")
            .update(content)
            .digest("hex");
          phase.lstats.set(file, "non-directory");
          phase.realpaths.set(file, path.join(physical, name));
          phase.hashes.set(file, digest);
        } catch {
          // Enumeration cannot establish search permission on the path.
        }
      }
    }
  }

  function observeLstat(resolved: string, phase: Phase): LstatKind {
    const existing = phase.lstats.get(resolved);
    if (existing !== undefined) {
      return existing;
    }
    const parent = path.dirname(resolved);
    if (parent !== resolved && hasAbsentOrNonDirectoryAncestor(parent, phase))
      return rememberMissing(resolved, phase);
    try {
      const stats = fs.lstatSync(resolved, { throwIfNoEntry: false });
      if (stats === undefined) return rememberMissing(resolved, phase);
      const kind: LstatKind = stats.isSymbolicLink()
        ? "symlink"
        : stats.isDirectory()
          ? "directory"
          : stats.isFile()
            ? "non-directory"
            : "other";
      phase.lstats.set(resolved, kind);
      if (kind === "non-directory") {
        const name = path.basename(resolved);
        const leaves = phase.ordinaryLeaves.get(parent);
        if (leaves === undefined) phase.ordinaryLeaves.set(parent, [name]);
        else leaves.push(name);
      }
      return kind;
    } catch (error) {
      if (RuntimeFilesystem.isMissingPathError(error))
        return rememberMissing(resolved, phase);
      phase.lstats.set(resolved, "error");
      return "error";
    }
  }

  function rememberMissing(resolved: string, phase: Phase): "missing" {
    phase.lstats.set(resolved, "missing");
    phase.hashes.set(resolved, null);
    phase.realpaths.set(resolved, null);
    return "missing";
  }

  /**
   * True only when a strict ancestor was already observed in this phase as
   * missing (`ENOENT`/`ENOTDIR`) or as a non-symlink non-directory. Symlink
   * parents never short-circuit descendants.
   */
  function hasAbsentOrNonDirectoryAncestor(
    parent: string,
    phase: Phase,
  ): boolean {
    let current = parent;
    for (;;) {
      const ancestor = phase.lstats.get(current);
      if (
        ancestor === "missing" ||
        ancestor === "non-directory" ||
        ancestor === "other"
      ) {
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
    const requested = phase.ordinaryLeaves.get(parent);
    if (requested === undefined || requested.length < MIN_SHARED_LEAVES) {
      return nativeRealpath(resolved);
    }
    const physicalParent = resolveDirectoryRealpath(parent, phase);
    if (physicalParent === null || physicalParent.includes("\0")) {
      return nativeRealpath(resolved);
    }
    const listing = listDirectory(physicalParent, requested, phase);
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
    requested: readonly string[],
    phase: Phase,
  ): DirectoryListing | null {
    if (phase.directoryEntries.has(physicalDirectory)) {
      return phase.directoryEntries.get(physicalDirectory)!;
    }
    let listing: DirectoryListing | null = null;
    const budget = requested.length * MAX_ENTRIES_PER_LEAF;
    const exact = new Map<string, fs.Dirent>();
    const pending = new Set(requested);
    try {
      const directory = fs.opendirSync(physicalDirectory, {
        bufferSize: Math.min(requested.length + 1, 256),
      });
      try {
        for (let count = 0; count <= budget; count++) {
          const entry = directory.readSync();
          if (entry === null) {
            listing = { exact, complete: true };
            break;
          }
          if (count === budget) break;
          exact.set(entry.name, entry);
          if (pending.delete(entry.name) && pending.size === 0) {
            listing = { exact, complete: false };
            break;
          }
        }
      } finally {
        directory.closeSync();
      }
    } catch {
      listing = null;
    }
    phase.directoryEntries.set(physicalDirectory, listing);
    return listing;
  }

  function lookupEntry(
    listing: DirectoryListing,
    lexicalName: string,
  ): string | undefined {
    if (lexicalName.includes("\ufffd")) return undefined;
    if (listing.exact.has(lexicalName)) {
      return lexicalName;
    }
    if (!listing.complete || !isAscii(lexicalName)) {
      return undefined;
    }
    if (listing.lower === undefined) {
      const lower = new Map<string, string | null>();
      for (const name of listing.exact.keys()) {
        const folded = name.toLowerCase();
        lower.set(folded, isAscii(name) && !lower.has(folded) ? name : null);
      }
      listing.lower = lower;
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
      return RuntimeFilesystem.realpathWitness(file);
    } catch {
      return null;
    }
  }
}
