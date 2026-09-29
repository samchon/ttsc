import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/**
 * The holder a plugin build lock generation records, and what can be proven
 * about it: a generation's `owner.json` names the process and host that took
 * it. Inspecting a held generation and collecting a retired one's tombstone
 * both decide from this one record.
 *
 * New holders also record generation and completion identity. Their qualified
 * marker proves that a payload task ended, even if its process remains alive;
 * it does not prove that outstanding leases or observer fences are unusable.
 *
 * @evidence contracts/common.md#principled-implementation Host and process identity are read from the generation's own record; only a local absence probe can establish that the recorded process is gone.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns holder representation, parsing, local liveness, qualified task completion and diagnostic labels shared by observation and cache collection.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native APIs supply process and host identity; an ambiguous probe failure is not replaced with an assumption that the owner died.
 * @evidence contracts/common.md#meaningful-documentation Native comments describe record absence, local versus remote identity, reused PIDs and conservative failure handling, with separated member documentation and tags.
 * @evidence contracts/portability.md#os-neutral-implementation Hostname and PID describe the recorded native process boundary; Node's host and signal-zero abstractions provide the local probe without shell or platform-specific commands.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups owner operations; its parsing, probing and formatting functions own their computation strategies.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace retains no result or in-flight producer across consumers.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace declaration acquires no handle, task or ownership record; callers own record publication and collection.
 */
export namespace PluginBuildLockOwner {
  /**
   * A generation's recorded holder. PID identity is meaningful only on its
   * named host; startedAt is descriptive metadata, not a PID-reuse proof.
   *
   * Build holders may include generation and completion identity. Older owners
   * and observer records omit them, so those records cannot prove task
   * completion.
   *
   * @evidence contracts/common.md#principled-implementation Hostname and a positive PID express local process identity; optional time, generation and completion nonce preserve newer holder metadata without requiring it in older or observer records.
   * @evidence contracts/common.md#clear-and-simple-design The record carries process facts without embedding liveness or generation-retirement policy in the data container.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No timestamp or numeric PID is treated as an authoritative cross-host process incarnation token.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains host-local PID meaning and timestamp limitations; member comments remain separate from checklist tags.
   * @evidence contracts/portability.md#os-neutral-implementation The hostname scopes the native PID, and the optional ISO timestamp is independent of platform process-table formatting.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms The record represents values and chooses no computation strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The record itself coordinates no shared work or cached liveness result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The record container does not acquire or release its consumers' filesystem tokens.
   */
  export interface IRecord {
    /** The holder's host name. */
    hostname: string;

    /** The holder's process id on that host. */
    pid: number;

    /** When the holder took the generation, when recorded. */
    startedAt?: string;

    /** The build generation, absent from observer and older owner records. */
    generation?: string;

    /** Nonce qualifying actual task completion, absent from older records. */
    completionNonce?: string;
  }

  /**
   * The holder recorded in a generation directory, or `null` when the record is
   * absent or malformed. Read failures also return null; absence of a usable
   * record does not prove the recorded process dead.
   *
   * Optional generation and completion nonce fields require valid protocol
   * spelling. Missing or invalid fields remain absent without invalidating an
   * otherwise usable process identity.
   *
   * @evidence contracts/common.md#principled-implementation JSON fields are checked before construction; optional generation and completion nonce require the protocol's 128-bit spelling, while absent older metadata remains unconfirmed.
   * @evidence contracts/common.md#clear-and-simple-design Parsing returns one nullable record and leaves age-based observation and process liveness to their respective owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed or unreadable metadata is not repaired into a fabricated owner or used as proof of process death.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes unusable records from dead processes and documents the nullable read result before its tags.
   * @evidence contracts/portability.md#os-neutral-implementation path.join and Node filesystem reads use native paths; read errors remain an inconclusive record observation on every platform.
   * @evidence contracts/performance.md#efficient-algorithms One owner file is read and parsed, with time and temporary space proportional to its JSON bytes rather than a directory or process-table scan.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Owner metadata can change as the current pathname changes generation, so a fresh filesystem observation cannot reuse an earlier parse without a validated identity.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous read returns a value and retains no descriptor, background task or cache population.
   */
  export function read(generationDir: string): IRecord | null {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(
          path.join(
            generationDir,
            PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE,
          ),
          "utf8",
        ),
      ) as Record<string, unknown>;
      if (
        typeof parsed.hostname !== "string" ||
        !Number.isInteger(parsed.pid) ||
        typeof parsed.pid !== "number" ||
        parsed.pid <= 0
      ) {
        return null;
      }
      return {
        hostname: parsed.hostname,
        pid: parsed.pid,
        startedAt:
          typeof parsed.startedAt === "string" ? parsed.startedAt : undefined,
        generation: PluginBuildLockProtocol.isPluginBuildLockGeneration(
          parsed.generation,
        )
          ? parsed.generation
          : undefined,
        completionNonce: PluginBuildLockProtocol.isPluginBuildLockGeneration(
          parsed.completionNonce,
        )
          ? parsed.completionNonce
          : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Whether this exact generation records the end of its holder's payload task.
   * A live process can finish a task; timeout retirement cannot prove that end.
   * Missing, malformed or unreadable metadata leaves completion unconfirmed.
   * This proof permits payload eviction, never removal of a live fence holder's
   * tombstone reservation.
   *
   * @evidence contracts/common.md#principled-implementation The generation file and owner generation must match the requested identity and its completion nonce must match the atomically published marker; a timeout or another generation cannot supply that proof.
   * @evidence contracts/common.md#clear-and-simple-design One conservative reader distinguishes payload-task completion from process absence, leaving eviction and tombstone lifetimes to their respective owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Elapsed time, retired ownership and a live-looking PID are not substituted for a release-owned completion witness.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs define exact-generation qualification, inconclusive failures and the separate payload versus fence lifetime before the tags.
   * @evidence contracts/portability.md#os-neutral-implementation Node path and UTF-8 file reads inspect protocol bytes through native filesystem abstractions without shell or platform-specific process state.
   * @evidence contracts/performance.md#efficient-algorithms Owner, generation and completion records are read directly; costs grow with their bytes, without enumerating unrelated generations.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A mutable coordination pathname requires a fresh qualified observation rather than a cached completion boolean.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The reader retains no handle or task; release publishes the witness and the collector owns its directory lifetime.
   */
  export function taskComplete(
    generationDir: string,
    generation: string,
  ): boolean {
    const owner = read(generationDir);
    if (
      owner === null ||
      owner.generation !== generation ||
      owner.completionNonce === undefined
    ) {
      return false;
    }
    try {
      return (
        fs
          .readFileSync(
            path.join(
              generationDir,
              PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_GENERATION_FILE,
            ),
            "utf8",
          )
          .trim() === generation &&
        fs.readFileSync(
          path.join(
            generationDir,
            PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_COMPLETION_FILE,
          ),
          "utf8",
        ) === `${owner.completionNonce}\n`
      );
    } catch {
      return false;
    }
  }

  /**
   * Whether the holder provably can no longer act: it ran on this host and no
   * process with its id exists. A holder on another host, or one whose id is
   * alive (possibly reused), is not proven gone.
   *
   * Only ESRCH proves absence. Permission errors, invalid probe arguments and
   * other failures remain inconclusive and must not authorize reclamation.
   *
   * @evidence contracts/common.md#principled-implementation Signal zero checks existence without terminating the process; same-host ESRCH establishes absence, while success or any other error does not.
   * @evidence contracts/common.md#clear-and-simple-design Host comparison and one native probe express the proof boundary directly, without a second process-discovery mechanism.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unexpected probe failures are not converted to a dead-owner special case or hidden behind retries.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish PID reuse, remote owners and each inconclusive failure class before the tags.
   * @evidence contracts/portability.md#os-neutral-implementation os.hostname and Node's platform-independent signal-zero probe preserve native host scope; only the explicit no-such-process code authorizes absence.
   * @evidence contracts/performance.md#efficient-algorithms A hostname comparison and one process-existence syscall avoid enumerating native processes; string comparison costs grow only with hostname length.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Liveness is a time-sensitive observation; a previously absent or present PID cannot be cached as proof for a later reclamation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The query owns no retained handle or running task and returns only its immediate proof decision.
   */
  export function gone(owner: IRecord): boolean {
    if (owner.hostname.toLowerCase() !== os.hostname().toLowerCase())
      return false;
    try {
      process.kill(owner.pid, 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ESRCH";
    }
  }

  /**
   * A human description of the holder, for lock diagnostics. The timestamp is
   * omitted when unavailable; this label does not establish liveness.
   *
   * @evidence contracts/common.md#principled-implementation Formatting the stored PID, hostname and optional timestamp gives users the identity metadata available without deriving unrecorded process facts.
   * @evidence contracts/common.md#clear-and-simple-design One label formatter keeps presentation independent of owner parsing and process probing.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The label reports recorded values without fabricating a process state or platform-specific command output.
   * @evidence contracts/common.md#meaningful-documentation Native prose states diagnostic purpose, optional timestamp omission and the absence of a liveness claim before its tags.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Formatting stored values is pure presentation and performs no native process or filesystem operation.
   *
   * @evidence contracts/performance.md#efficient-algorithms One optional suffix and one label concatenation cost time and space proportional to the supplied hostname and timestamp text.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The formatter does not coordinate completed or in-flight work across requests.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returning a string acquires no handle, task or retained cache population.
   */
  export function describe(owner: IRecord): string {
    const started =
      owner.startedAt === undefined ? "" : ` started at ${owner.startedAt}`;
    return `pid ${owner.pid} on ${owner.hostname}${started}`;
  }
}
