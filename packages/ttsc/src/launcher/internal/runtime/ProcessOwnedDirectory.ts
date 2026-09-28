import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isLocalProcessGone } from "./isLocalProcessGone";

/**
 * A directory the processes that use it own while they run, identified by one
 * owner record per process inside it, so the directory of a run whose processes
 * were all killed before any could remove it can be told apart from one still
 * in use and reclaimed by another process.
 */
export namespace ProcessOwnedDirectory {
  /** How an owned directory relates to its owners. */
  export type Ownership = "abandoned" | "live" | "unknown" | "unowned";

  /**
   * Create `directory` and record this process as its owner.
   *
   * @param directory The directory this process now owns.
   */
  export function claim(directory: string): void {
    fs.mkdirSync(directory, { recursive: true });
    admit(directory, process.pid);
  }

  /**
   * Record the process `pid` of this host as an owner of `directory`, as one
   * that uses it and may outlive the process that claimed it, such as a program
   * that process spawned. Each record is written once under a name of its own
   * and never rewritten. An unreadable or malformed owner record leaves the
   * directory's ownership unknown, so cleanup cannot take it as abandoned.
   *
   * @param directory A directory this process claimed.
   * @param pid The process that owns it too.
   */
  export function admit(directory: string, pid: number): void {
    fs.writeFileSync(
      recordPath(directory, pid),
      JSON.stringify({ hostname: os.hostname(), pid }),
      "utf8",
    );
  }

  /** Relinquish this process's claim while holding the runtime directory lock. */
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
   */
  export function sweep(
    parent: string,
    accepts: (name: string) => boolean = () => true,
    legacyProcessRoot = false,
  ): void {
    let entries: string[];
    try {
      entries = fs.readdirSync(parent);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!accepts(entry)) continue;
      const directory = path.join(parent, entry);
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
