import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isLocalProcessGone } from "./isLocalProcessGone";

/**
 * A directory the processes that use it own while they run, identified by one
 * owner record per process inside it, so the directory of a run whose processes
 * were all killed before any could remove it can be told apart from one still
 * in use and reclaimed by another process.
 *
 * @evidence contracts/common.md#principled-implementation Per-host-pid records distinguish a directory with any live or uncertain owner from one whose every validated owner is provably gone; reclaiming requires evidence rather than merely old age.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns claim, admission, relinquishment and sweeping over the same record grammar, while native process liveness remains in its dedicated predicate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown, unowned and remote-owner directories are preserved rather than deleted to satisfy a cleanup expectation; generation and runtime locks remain callers' synchronization responsibilities.
 * @evidence contracts/common.md#meaningful-documentation Native purpose and operation comments explain ownership transitions, uncertainty, legacy records and pinned-parent sweeping; documented properties remain free of acknowledgment tags.
 * @evidence contracts/portability.md#os-neutral-implementation Node fs/path and local-host process probes preserve native identity; sweep resolves linked parents before selecting recursive-removal paths and treats links as links.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups lifecycle operations; each concrete operation explains its own record and directory processing cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Ownership effects and observations do not form a reusable result cache at this grouping boundary.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no owner registry in memory; individual operations define persisted-record and directory lifetime.
 */
export namespace ProcessOwnedDirectory {
  /**
   * How an owned directory relates to its owners. Only abandoned permits
   * reclamation; unknown and unowned preserve the entry.
   *
   * @evidence contracts/common.md#principled-implementation Four states separate all-proven-dead owners from a live owner, unreadable evidence and absent records; absence cannot safely imply abandonment during admission.
   * @evidence contracts/common.md#clear-and-simple-design A literal union carries the cleanup decision without optional diagnostic fields or a second boolean that could contradict it.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown or absent evidence remains distinct from deletion authority instead of being collapsed into a false live flag.
   * @evidence contracts/common.md#meaningful-documentation Native prose states which state allows reclamation and why unknown/unowned preserve an entry.
   * @evidence contracts/portability.md#os-neutral-implementation States summarize native directory and local process observations without exposing platform-specific errno as ownership values.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This literal representation selects no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The state type does not coordinate requests or validate cached ownership.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This value type acquires no owner record, directory or process.
   */
  export type Ownership = "abandoned" | "live" | "unknown" | "unowned";

  /**
   * Create `directory` and record this process as its owner.
   *
   * @param directory The directory this process now owns.
   *
   * @evidence contracts/common.md#principled-implementation Recursive directory creation precedes a host-pid admission record, making a prepared run explicitly attributable to this process before other synchronized callers classify it.
   * @evidence contracts/common.md#clear-and-simple-design Claim reuses admission's record writer instead of maintaining a second owner format.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The current pid and actual hostname establish the claim; no assumed liveness based on a directory name substitutes for its record.
   * @evidence contracts/common.md#meaningful-documentation Native purpose and parameter identify the ownership transition; admission separately documents the persisted claim semantics.
   * @evidence contracts/portability.md#os-neutral-implementation Node's native mkdir and fs record write use the supplied directory spelling; callers pin cleanup authority and serialize shared roots through their runtime lock.
   * @evidence contracts/performance.md#efficient-algorithms Creation follows missing parent depth and writes one small owner record, without scanning sibling runs.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A claim changes filesystem ownership; a prior claim result cannot replace recording the current process.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the created directory and persisted record; a failed admission can leave a created unowned directory, which the acquiring owner must roll back when it has exclusive authority.
   */
  export function claim(directory: string): void {
    fs.mkdirSync(directory, { recursive: true });
    admit(directory, process.pid);
  }

  /**
   * Record the process `pid` of this host as an owner of `directory`, as one
   * that uses it and may outlive the process that claimed it, such as a program
   * that process spawned. Each pid has its own record name; repeated admission
   * refreshes that pid's claim. An unreadable or malformed owner record leaves
   * the directory's ownership unknown, so cleanup cannot take it as abandoned.
   *
   * @param directory A directory this process claimed.
   * @param pid The process that owns it too.
   *
   * @evidence contracts/common.md#principled-implementation A pid-named record stores this host and the admitted pid, allowing later validation to compare filename identity with its contents and conservatively probe the same native owner.
   * @evidence contracts/common.md#clear-and-simple-design One writer owns the record grammar shared by initial claim and child admission; callers retain synchronization and process-transfer policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual host and pid values record supported ownership transfer without special-casing a launcher or expected cleanup result.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains child ownership, repeated admission and malformed-record conservatism; parameters distinguish directory and admitted process.
   * @evidence contracts/portability.md#os-neutral-implementation os.hostname and Node fs establish native host-scoped process identity; record basenames use a numeric pid and path.join rather than platform-specific process-file conventions.
   * @evidence contracts/performance.md#efficient-algorithms Admission constructs and writes one bounded owner record without listing existing owners.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Writing or refreshing ownership is an effect, not a previously computed result that another call can share.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The persisted record remains while its admitted process may use the directory; relinquish removes a claim, and a later sweep can reclaim all-dead directories after forced termination.
   */
  export function admit(directory: string, pid: number): void {
    fs.writeFileSync(
      recordPath(directory, pid),
      JSON.stringify({ hostname: os.hostname(), pid }),
      "utf8",
    );
  }

  /**
   * Relinquish the specified pid's claim while holding the runtime directory
   * lock. Other owners and the directory itself remain untouched.
   *
   * @evidence contracts/common.md#principled-implementation Removing only the selected pid record ends that ownership claim without erasing another live process's authority over the same run.
   * @evidence contracts/common.md#clear-and-simple-design One explicit record removal separates relinquishment from whole-directory cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Release does not recursively clear a shared directory or infer that other owners died with the caller.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the required lock, selected-pid behavior and preservation of other owners.
   * @evidence contracts/portability.md#os-neutral-implementation Native fs removal targets the numeric pid record through path.join; force handles an already absent record without relying on shell deletion behavior.
   * @evidence contracts/performance.md#efficient-algorithms One fixed record path is removed without an owner-directory scan.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Relinquishment is an ownership effect that cannot share a previous result as a current release.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The operation removes one persisted claim; remaining claims and the run directory stay with their other owners and later reclamation policy.
   */
  export function relinquish(directory: string, pid = process.pid): void {
    fs.rmSync(recordPath(directory, pid), { force: true });
  }

  /**
   * Whether any owner `directory` records is alive, every one is provably gone,
   * or none is recorded at all. An unreadable directory or owner record has
   * unknown ownership. An owner on another host, or a pid something else now
   * holds, counts as alive, since neither is provably gone
   * (`isLocalProcessGone`).
   *
   * @param legacyProcessRoot Also read the former `owner.json` record in a
   *   manifest-less `process-<pid>-<nonce>` dependency cache directory.
   *
   * @evidence contracts/common.md#principled-implementation Validated pid-named records must all prove local absence for abandonment; any live/remote/recycled owner wins, malformed evidence stays unknown, and absent records remain unowned.
   * @evidence contracts/common.md#clear-and-simple-design One scan aggregates live, uncertain and dead evidence, with record syntax and process liveness delegated to private decoding and the shared predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Directory names alone do not establish ownership; the explicitly supported legacy owner record is checked against its pid-bearing directory grammar.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain unreadable, remote and recycled ownership, plus the optional legacy format rather than suggesting every nonlive-looking entry can be removed.
   * @evidence contracts/portability.md#os-neutral-implementation Native directory/record reads and local-host pid probing preserve Windows and POSIX behavior; denied reads remain unknown rather than being classified from error-message text.
   * @evidence contracts/performance.md#efficient-algorithms One directory listing examines E names and at most R owner records, with early exit for a non-gone owner; temporary names occupy O(E) space.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Owner records and process existence can change; the caller's lock bounds a current decision, not a cached historical result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The observation opens no retained descriptor and does not acquire or release the directory; its state transfers the decision to cleanup.
   */
  export function ownership(
    directory: string,
    legacyProcessRoot = false,
  ): Ownership {
    let names: string[];
    try {
      names = fs.readdirSync(directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return code === "ENOENT" || code === "ENOTDIR" ? "unowned" : "unknown";
    }
    let owned = false;
    let unknown = false;
    for (const name of names) {
      if (
        (!name.startsWith(RECORD_PREFIX) || !name.endsWith(RECORD_SUFFIX)) &&
        !(legacyProcessRoot && name === "owner.json")
      )
        continue;
      const owner = readRecord(path.join(directory, name));
      if (owner === null) {
        unknown = true;
        continue;
      }
      if (!isLocalProcessGone(owner)) return "live";
      owned = true;
    }
    return unknown ? "unknown" : owned ? "abandoned" : "unowned";
  }

  /**
   * Remove the entries of `parent` whose owners are all provably gone. An entry
   * without an owner record is left alone: its process may have created it and
   * not yet recorded itself. Removal takes a link inside an entry as a link,
   * never what it points at, and a failure leaves the entry to a later sweep.
   *
   * @param parent The directory holding owned entries.
   * @param accepts Which entry names are owned directories.
   * @param legacyProcessRoot Include the prior manifest-less owner format.
   *
   * @evidence contracts/common.md#principled-implementation A pinned physical parent and all-proven-dead ownership select only abandoned entries; missing, malformed and live claims are preserved, preventing alias retargeting from choosing another same-named removal target.
   * @evidence contracts/common.md#clear-and-simple-design The sweep separates one parent snapshot, caller-defined entry selection and shared ownership classification before best-effort removal.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed inspection or deletion does not trigger broader cleanup; the operation never treats a caller's accepted name as proof that its owner is dead.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain unowned preservation, link treatment and later retry, with parameters identifying selection and legacy support.
   * @evidence contracts/portability.md#os-neutral-implementation realpathSync.native fixes parent identity before listings and joins; Node recursive rm removes link entries without traversing their targets, and native pid evidence remains conservative.
   * @evidence contracts/performance.md#efficient-algorithms One sibling listing and one ownership scan per accepted entry cost their combined names and owner records; recursive deletion adds the reclaimed tree size without repeatedly scanning the parent.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Abandonment and removal are current filesystem effects; a prior sweep cannot stand in for changed records or a newly dead process.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The sweep reclaims abandoned persisted trees; unreadable, unowned or live entries remain, and removal failures are retried by a later sweep rather than hidden by deleting a broader parent.
   */
  export function sweep(
    parent: string,
    accepts: (name: string) => boolean = () => true,
    legacyProcessRoot = false,
  ): void {
    let entries: string[];
    let physicalParent: string;
    try {
      // Pin a linked parent before reading any owner. A retarget between the
      // listing and rmSync must not select a different same-named entry.
      physicalParent = fs.realpathSync.native(parent);
      entries = fs.readdirSync(physicalParent);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!accepts(entry)) continue;
      const directory = path.join(physicalParent, entry);
      if (ownership(directory, legacyProcessRoot) !== "abandoned") continue;
      try {
        fs.rmSync(directory, { force: true, recursive: true });
      } catch {
        // Held open or concurrently removed: a later sweep retries.
      }
    }
  }

  const RECORD_PREFIX = "owner-";
  const RECORD_SUFFIX = ".json";

  function recordPath(directory: string, pid: number): string {
    return path.join(directory, `${RECORD_PREFIX}${pid}${RECORD_SUFFIX}`);
  }

  function readRecord(file: string): { hostname: string; pid: number } | null {
    try {
      const owner = JSON.parse(fs.readFileSync(file, "utf8")) as {
        hostname?: unknown;
        pid?: unknown;
      };
      const name = path.basename(file);
      const pidText =
        name === "owner.json"
          ? /^process-(\d+)-[0-9a-f]+$/.exec(
              path.basename(path.dirname(file)),
            )?.[1]
          : name.slice(
              RECORD_PREFIX.length,
              name.length - RECORD_SUFFIX.length,
            );
      const namedPid =
        pidText !== undefined && /^\d+$/.test(pidText)
          ? Number(pidText)
          : undefined;
      if (
        typeof owner.hostname !== "string" ||
        owner.hostname.length === 0 ||
        typeof owner.pid !== "number" ||
        !Number.isSafeInteger(owner.pid) ||
        owner.pid <= 0 ||
        namedPid === undefined ||
        owner.pid !== namedPid
      ) {
        return null;
      }
      return { hostname: owner.hostname, pid: owner.pid };
    } catch {
      return null;
    }
  }
}
