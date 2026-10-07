import fs from "node:fs";
import path from "node:path";

import { retireLockDirectory } from "../../../internal/retireLockDirectory";
import type { PluginBuildLockFence } from "./PluginBuildLockFence";

/**
 * The on-disk layout of the source-plugin build lock and the primitives every
 * lock operation shares.
 *
 * A cold source-plugin build delegates work to `go build`; its duration depends
 * on the selected inputs and toolchain cache. When a program fans out into many
 * processes (a `pnpm -r` running suites in parallel, a benchmark, a worker
 * pool), each inherits the same cold cache and would otherwise build the same
 * cache key at the same instant. Cooperating v3 consumers serialize build
 * ownership while waiters observe publication or fail their admission budget;
 * this does not serialize old-protocol clients.
 *
 * V3 lives in `<lockDir>.v3`. A complete generation is published at `current/`
 * and retired by renaming it to `retired/<generation>`. Holder and observer
 * records keep that destination reserved while a process can still use its
 * lease or fence. Persistent roots are not deleted with binary cache entries.
 * Release alone records task completion in the exact retired generation after
 * the payload callback ends; timeout retirement cannot supply that witness.
 *
 * Old v2 clients use a separate namespace and cannot retire v3 generations. The
 * pre-v2 legacy protocol held `<lockDir>` itself; its captured fence preserves
 * the original directory mtime but cannot add atomic cooperation to old
 * executables that remove and recreate that path.
 *
 * @evidence contracts/common.md#principled-implementation Nonempty publication and deterministic retirement destinations establish generation ownership; recorded observers preserve the fencing premise after the original holder dies.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns layout constants, validation and native retirement adapters shared by acquisition, observation, release and reclamation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Protocol-defined filenames and time budgets express supported coordination; v3 is isolated from old clients instead of assuming their unregistered capabilities expired.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain layout, observer-protected history, persistent roots and old-protocol limits; members document their purpose separately from their tags.
 * @evidence contracts/portability.md#os-neutral-implementation Protocol names remain fixed spelling while path.join and Node filesystem abstractions carry native paths and the rename helper handles observed Windows sharing refusals.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace groups protocol operations; individual functions own their computation strategies.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace is not a cache or in-flight producer; acquisition and observation own their respective sharing decisions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace declaration acquires no resources; its acquisition, retirement and observation operations own their lifetimes.
 */
export namespace PluginBuildLockProtocol {
  /**
   * Maximum admission-wait budget for a source-plugin build. Exhaustion fails
   * the request; it cannot authorize retirement of a live or uncertain holder.
   */
  export const PLUGIN_BUILD_LOCK_WAIT_MS = 600_000;

  /**
   * How long one wait of the lock protocol yields: a waiter's poll of the
   * holder, and a retire's wait for a peer's read of the held generation to end
   * (`retireLockDirectory`).
   */
  export const PLUGIN_BUILD_LOCK_POLL_MS = 50;

  /** File inside a generation directory recording the holder's pid and host. */
  export const PLUGIN_BUILD_LOCK_OWNER_FILE = "owner.json";

  /** File proving that the recorded holder's payload callback has ended. */
  export const PLUGIN_BUILD_LOCK_COMPLETION_FILE = "task-complete";

  /** Marker file whose exact content proves a directory speaks protocol v3. */
  export const PLUGIN_BUILD_LOCK_PROTOCOL_FILE = "protocol-v3";

  /** File inside a generation directory holding its hex id. */
  export const PLUGIN_BUILD_LOCK_GENERATION_FILE = "generation";

  /** Directory recording the fence of a captured legacy lock. */
  export const PLUGIN_BUILD_LOCK_LEGACY_FENCE_DIR = "legacy-generation";

  /** File inside the legacy fence directory holding its generation and mtime. */
  export const PLUGIN_BUILD_LOCK_LEGACY_FENCE_RECORD = "fence.json";

  /** Directory name of the held v3 generation. */
  export const PLUGIN_BUILD_LOCK_CURRENT_DIR = "current";

  /** Directory holding one tombstone per retired v3 generation. */
  export const PLUGIN_BUILD_LOCK_RETIRED_DIR = "retired";

  /** Directory containing the recorded processes that hold observed fences. */
  export const PLUGIN_BUILD_LOCK_OBSERVERS_DIR = "observers";

  const PLUGIN_BUILD_LOCK_V3_SUFFIX = ".v3";

  /** Exact content of the protocol marker file. */
  export const PLUGIN_BUILD_LOCK_PROTOCOL = "ttsc-plugin-build-lock-v3\n";

  /**
   * The persistent v3 coordination path derived from a legacy lock path.
   *
   * @evidence contracts/common.md#principled-implementation Appending the version suffix separates new ownership and tombstones from old v2 clients without changing the caller's cache-key identity.
   * @evidence contracts/common.md#clear-and-simple-design One derivation supplies the same coordination namespace to every lock operation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The suffix is a protocol discriminant, not a machine or consumer-specific pathname exception.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies persistent coordination and its legacy-path input before the tags.
   * @evidence contracts/portability.md#os-neutral-implementation The suffix changes a path component's spelling without choosing native separators or assuming filesystem case policy.
   * @evidence contracts/performance.md#efficient-algorithms A single string concatenation costs time and space proportional to the input path length.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Path derivation is not a coordinator of completed or in-flight build work and retains no shared result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned path carries no acquired handle, task or retained cache state.
   */
  export function pluginBuildLockProtocolDir(lockDir: string): string {
    return `${lockDir}${PLUGIN_BUILD_LOCK_V3_SUFFIX}`;
  }

  /**
   * Whether `lockDir` is a real directory (not a link) whose protocol marker
   * has exactly the v3 content at its sequential metadata/read observations.
   * The pathname is not pinned against replacement between them. Read failures
   * remain an unconfirmed layout.
   *
   * @evidence contracts/common.md#principled-implementation lstat rejects a linked root and exact marker content distinguishes this version's filesystem protocol from unrelated directories.
   * @evidence contracts/common.md#clear-and-simple-design One layout predicate centralizes version recognition without acquiring or retiring ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Recognition reads actual metadata instead of inferring protocol from an OS name or directory suffix alone.
   * @evidence contracts/common.md#meaningful-documentation Native prose documents observed root kind and marker requirements, sequential replacement limits and inconclusive read failure before the tags.
   * @evidence contracts/portability.md#os-neutral-implementation Node lstat exposes actual link and directory capabilities; exact marker bytes are protocol identity independent of native path case behavior.
   * @evidence contracts/performance.md#efficient-algorithms One lstat and one marker read avoid directory enumeration; processing and temporary space include path construction and the marker file's bytes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Protocol recognition must observe the current pathname because a previously recognized layout can disappear or be replaced.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous predicate retains no open descriptor or background state.
   */
  export function isPluginBuildLockProtocolV3(lockDir: string): boolean {
    try {
      const stats = fs.lstatSync(lockDir);
      if (!stats.isDirectory() || stats.isSymbolicLink()) return false;
      return (
        fs.readFileSync(
          path.join(lockDir, PLUGIN_BUILD_LOCK_PROTOCOL_FILE),
          "utf8",
        ) === PLUGIN_BUILD_LOCK_PROTOCOL
      );
    } catch {
      return false;
    }
  }

  /**
   * Retire `generation` if it is still the held v3 one, by renaming `current/`
   * onto its tombstone. Returns `false` when the lock is already free or held
   * by another generation; throws only on an unexpected filesystem error.
   *
   * Its nonempty destination must remain while the recorded holder or any
   * registered observer can still act. A pre-rename identity read alone would
   * not close the replacement race.
   *
   * @evidence contracts/common.md#principled-implementation A reserved nonempty tombstone makes the rename fail atomically for a stale generation; observer-aware collection preserves that reservation until all recorded capability holders are gone.
   * @evidence contracts/common.md#clear-and-simple-design The operation validates the token and derives one retirement destination, leaving owner proofs to observation and collection.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Retirement preserves generation history and uses the shared native rename primitive rather than replacing fencing with a racy read followed by recursive removal.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the return/error contract, required tombstone lifetime and the reason a generation read is insufficient before the tags.
   * @evidence contracts/portability.md#os-neutral-implementation Node path and filesystem operations feed the shared retirement helper. Selected Windows refusals retry after a successful sibling-rename probe; this is a sampled capability, not proof that a peer read caused the original refusal.
   * @evidence contracts/performance.md#efficient-algorithms Direct generation addressing avoids historical scans. Each attempt performs path construction and native metadata/rename observations; eligible Windows retries add sibling probes and synchronous poll waits, with no attempt-count or elapsed-time bound in this retirement operation.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Retirement changes ownership; its result cannot be memoized across independently racing callers.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Renaming transfers the directory into history; the cooperating collector requires holder/observer absence before removal. Retry-probe deletion is best-effort and may leave empty siblings. A continuing eligible refusal can retain this synchronous operation indefinitely; it installs no asynchronous handle.
   */
  export function retireV3PluginBuildLock(
    lockDir: string,
    generation: string,
  ): boolean {
    if (!isPluginBuildLockGeneration(generation)) return false;
    const retiredDir = path.join(lockDir, PLUGIN_BUILD_LOCK_RETIRED_DIR);
    try {
      fs.mkdirSync(retiredDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        if (isMissingPathError(error)) return false;
        throw error;
      }
    }

    return retireLockDirectory(
      path.join(lockDir, PLUGIN_BUILD_LOCK_CURRENT_DIR),
      path.join(retiredDir, generation),
      () => sleepSync(PLUGIN_BUILD_LOCK_POLL_MS),
    );
  }

  /**
   * Whether an error proves a path or one of its parents is absent.
   *
   * @evidence contracts/common.md#principled-implementation ENOENT and ENOTDIR denote missing path structure, while permission and sharing errors do not establish absence.
   * @evidence contracts/common.md#clear-and-simple-design One errno predicate keeps path absence separate from contention and other failure policies.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unexpected filesystem failures are not broadened into absence to make lock operations succeed.
   * @evidence contracts/common.md#meaningful-documentation Native prose names the absence proof boundary before the tags.
   * @evidence contracts/portability.md#os-neutral-implementation Node errno codes abstract native filesystem error representation; the predicate classifies actual error meaning without an OS-name branch.
   * @evidence contracts/performance.md#efficient-algorithms Two code comparisons require constant work and allocate no traversal state.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This classification does not coordinate a computation across requests.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate acquires and retains no resources.
   */
  export function isMissingPathError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR";
  }

  /**
   * Whether a native rename failure is treated as destination contention.
   * EACCES/EPERM require an observed destination, but its existence does not
   * prove it caused the failure; unrelated permissions can produce those
   * codes.
   *
   * @evidence contracts/common.md#principled-implementation Explicit occupied-destination codes select contention; ambiguous permission codes select the same policy only with observed destination existence. That extra observation is a contention policy rather than a causal permission diagnosis.
   * @evidence contracts/common.md#clear-and-simple-design One adapter distinguishes destination occupation from other rename failures for protocol initialization and observer publication.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Permission errors alone are not relabeled as a successful peer race, so unexpected failures remain visible.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the native-error classification and the existence observation's causal limit before the tags.
   * @evidence contracts/portability.md#os-neutral-implementation Node error codes plus an actual destination lookup represent Windows and POSIX rename outcomes through one boundary.
   * @evidence contracts/performance.md#efficient-algorithms Fixed code comparisons perform at most one native destination existence lookup and no explicit parent scan; lookup costs include the destination path and native filesystem resolution.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Destination occupancy is observed at the failed operation and cannot be cached as a later ownership decision.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The adapter owns no retained handle or task.
   */
  export function isRenameDestinationOccupied(
    error: unknown,
    destination: string,
  ): boolean {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST" || code === "ENOTEMPTY") {
      return true;
    }
    return (
      (code === "EACCES" || code === "EPERM") && fs.existsSync(destination)
    );
  }

  /**
   * A legacy fence and the original directory mtime expected by older readers.
   *
   * @evidence contracts/common.md#principled-implementation Captured generation and original mtime preserve the legacy record shape older readers require; this mtime does not prove that an unrecorded task ended.
   * @evidence contracts/common.md#clear-and-simple-design The record carries only captured identity and age origin; inspection and retirement retain their own responsibilities.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Observational absence is not encoded as an infinite age and fence publication does not fabricate a fresh legacy creation time.
   * @evidence contracts/common.md#meaningful-documentation Native prose and separated member comments distinguish legacy record compatibility from actual process-absence proof.
   * @evidence contracts/portability.md#os-neutral-implementation The record uses protocol identity and filesystem mtime milliseconds rather than parsing platform-specific stat output.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms The record stores captured values and chooses no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The record represents one capture and does not coordinate shared computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The container owns no lock directory or running task; capture and collection own their lifetimes.
   */
  export interface LegacyPluginBuildLockFence {
    /** The fence handed to the reclaimer, tagged as the legacy protocol. */
    fence: PluginBuildLockFence;

    /**
     * The legacy lock directory's mtime when the fence was first captured. An
     * older reader may measure ownerless age from it, because recording the
     * fence advances the directory's mtime. This metadata remains for record
     * compatibility; current inspection never treats elapsed age as task
     * death.
     */
    legacyMtimeMs: number;
  }

  /**
   * Read a captured legacy fence, or null when missing, unreadable or
   * malformed.
   *
   * @evidence contracts/common.md#principled-implementation Validating a 128-bit generation and finite nonnegative mtime preserves the exact identity and age data required for a captured legacy fence.
   * @evidence contracts/common.md#clear-and-simple-design The reader parses one record and leaves liveness classification and retirement to their owning operations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid metadata remains unconfirmed rather than being coerced to an infinite age or a made-up generation.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes missing, unreadable and malformed records before the nullable reader's tags.
   * @evidence contracts/portability.md#os-neutral-implementation path.join and Node UTF-8 reads use native paths while generation and millisecond mtime remain platform-independent protocol values.
   * @evidence contracts/performance.md#efficient-algorithms A single JSON file read and parse costs time and temporary space proportional to that record's bytes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A fence pathname may move with retirement or disappear, so the caller requires a fresh identity observation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous read returns data without retaining a descriptor or historical cache.
   */
  export function readLegacyPluginBuildLockFence(
    fenceDir: string,
  ): LegacyPluginBuildLockFence | null {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(
          path.join(fenceDir, PLUGIN_BUILD_LOCK_LEGACY_FENCE_RECORD),
          "utf8",
        ),
      ) as Record<string, unknown>;
      if (
        !isPluginBuildLockGeneration(parsed.generation) ||
        typeof parsed.legacyMtimeMs !== "number" ||
        !Number.isFinite(parsed.legacyMtimeMs) ||
        parsed.legacyMtimeMs < 0
      ) {
        return null;
      }
      return {
        fence: { protocol: "legacy", generation: parsed.generation },
        legacyMtimeMs: parsed.legacyMtimeMs,
      };
    } catch {
      return null;
    }
  }

  /**
   * True for exactly 32 lowercase hexadecimal characters, the generation
   * format.
   *
   * @evidence contracts/common.md#principled-implementation The anchored pattern admits exactly the 128-bit hexadecimal spelling produced by generation creation.
   * @evidence contracts/common.md#clear-and-simple-design One type predicate centralizes token shape validation without choosing an owner or querying the filesystem.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The pattern is the protocol's explicit grammar rather than a list of expected generation values.
   * @evidence contracts/common.md#meaningful-documentation Native prose states exact length, case and digit vocabulary before the tags.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This is a pure protocol-string predicate with no native filesystem or process operation.
   *
   * @evidence contracts/performance.md#efficient-algorithms A fixed-length anchored hexadecimal pattern avoids parsing arbitrary numeric values or allocating a decoded byte buffer.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Token shape checking coordinates no shared computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate retains no state or acquired resource.
   */
  export function isPluginBuildLockGeneration(value: unknown): value is string {
    return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
  }

  /**
   * Block the synchronous thread for ms without polling the clock in a loop.
   * Protocol callers supply a finite interval. This primitive imposes no
   * overall retry budget; admission waiters manage one, while retirement's
   * eligible native retries can continue without a deadline.
   *
   * @evidence contracts/common.md#principled-implementation Atomics.wait suspends the thread on an unchanged shared cell until its supplied timeout, providing the synchronous protocol yield.
   * @evidence contracts/common.md#clear-and-simple-design The primitive waits once; callers own polling and whether an overall deadline exists.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A standard waiting primitive replaces busy-spinning without a host-specific command or invented completion signal.
   * @evidence contracts/common.md#meaningful-documentation Native prose states blocking behavior, protocol interval inputs and the distinction between budgeted admission and unbounded eligible retirement retries before the tags.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The JavaScript shared-memory wait performs no filesystem or process-launch boundary operation.
   *
   * @evidence contracts/performance.md#efficient-algorithms One shared four-byte cell provides a single blocking wait without repeated clock reads or CPU polling.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Independent protocol waits are scheduling effects rather than reusable completed computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call starts no timer task or retained worker; its temporary cell becomes collectible after the synchronous wait.
   */
  export function sleepSync(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  }
}
