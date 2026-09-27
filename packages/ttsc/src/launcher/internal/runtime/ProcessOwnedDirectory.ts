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
  export type Ownership = "abandoned" | "live" | "unowned";

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
   * and never rewritten, and a record that does not parse, as one being written
   * does not, counts as absent.
   *
   * @param directory A directory this process claimed.
   * @param pid The process that owns it too.
   */
  export function admit(directory: string, pid: number): void {
    fs.writeFileSync(
      path.join(directory, `${RECORD_PREFIX}${pid}${RECORD_SUFFIX}`),
      JSON.stringify({ hostname: os.hostname(), pid }),
      "utf8",
    );
  }

  /**
   * Whether any owner `directory` records is alive, every one is provably gone,
   * or none is recorded at all. An owner on another host, or a pid something
   * else now holds, counts as alive, since neither is provably gone
   * (`isLocalProcessGone`).
   */
  export function ownership(directory: string): Ownership {
    let names: string[];
    try {
      names = fs.readdirSync(directory);
    } catch {
      return "unowned";
    }
    let owned = false;
    for (const name of names) {
      if (!name.startsWith(RECORD_PREFIX) || !name.endsWith(RECORD_SUFFIX))
        continue;
      const owner = readRecord(path.join(directory, name));
      if (owner === null) continue;
      if (!isLocalProcessGone(owner)) return "live";
      owned = true;
    }
    return owned ? "abandoned" : "unowned";
  }

  /**
   * Remove the entries of `parent` whose owners are all provably gone. An entry
   * without an owner record is left alone: its process may have created it and
   * not yet recorded itself. Removal takes a link inside an entry as a link,
   * never what it points at, and a failure leaves the entry to a later sweep.
   *
   * @param parent The directory holding owned entries.
   * @param accepts Which entry names are owned directories.
   */
  export function sweep(
    parent: string,
    accepts: (name: string) => boolean = () => true,
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
      if (ownership(directory) !== "abandoned") continue;
      try {
        fs.rmSync(directory, { force: true, recursive: true });
      } catch {
        // Held open or concurrently removed: a later sweep retries.
      }
    }
  }

  const RECORD_PREFIX = "owner-";
  const RECORD_SUFFIX = ".json";

  function readRecord(file: string): { hostname: string; pid: number } | null {
    try {
      const owner = JSON.parse(fs.readFileSync(file, "utf8")) as {
        hostname?: unknown;
        pid?: unknown;
      };
      return typeof owner.hostname === "string" && typeof owner.pid === "number"
        ? { hostname: owner.hostname, pid: owner.pid }
        : null;
    } catch {
      return null;
    }
  }
}
