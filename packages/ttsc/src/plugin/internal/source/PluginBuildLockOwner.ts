import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/**
 * The holder a plugin build lock generation records, and what can be proven
 * about it: a generation's `owner.json` names the process and host that took
 * it. Inspecting a held generation and collecting a retired one's tombstone
 * both decide from this one record.
 */
export namespace PluginBuildLockOwner {
  /** A generation's recorded holder. */
  export interface IRecord {
    /** The holder's host name. */
    hostname: string;
    /** The holder's process id on that host. */
    pid: number;
    /** When the holder took the generation, when recorded. */
    startedAt?: string;
  }

  /**
   * The holder recorded in a generation directory, or `null` when the record is
   * absent or malformed.
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
      };
    } catch {
      return null;
    }
  }

  /**
   * Whether the holder provably can no longer act: it ran on this host and no
   * process with its id exists. A holder on another host, or one whose id is
   * alive (possibly reused), is not proven gone.
   */
  export function gone(owner: IRecord): boolean {
    if (owner.hostname.toLowerCase() !== os.hostname().toLowerCase())
      return false;
    try {
      process.kill(owner.pid, 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== "EPERM";
    }
  }

  /** A human description of the holder, for lock diagnostics. */
  export function describe(owner: IRecord): string {
    const started =
      owner.startedAt === undefined ? "" : ` started at ${owner.startedAt}`;
    return `pid ${owner.pid} on ${owner.hostname}${started}`;
  }
}
