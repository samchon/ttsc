import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";

import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Coordination between Go builds that use ttsc's own Go object cache and the
 * pruning that keeps that cache bounded.
 *
 * Every build and every maintenance pass publishes a record in a private
 * directory of the cache and keeps it fresh with a heartbeat. Pruning skips the
 * cohort a live build may still read, and an abandoned record expires after a
 * grace period, so a crashed process never pins the cache forever and a running
 * build never has its objects deleted underneath it.
 */
export namespace GoBuildCacheCoordination {
  /** Directory of the cache holding one record per running Go build. */
  export const GO_BUILD_CACHE_LEASE_DIR = ".ttsc-build-leases";

  /** Directory of the cache holding one record per running maintenance pass. */
  export const GO_BUILD_CACHE_MAINTENANCE_DIR = ".ttsc-maintenance";

  const GO_BUILD_CACHE_COORDINATION_STALE_MS = 60 * 60 * 1000;

  const GO_BUILD_CACHE_MAINTENANCE_STALE_MS = 60 * 1000;

  const GO_BUILD_CACHE_COORDINATION_CLOCK_SKEW_MS = 5 * 60 * 1000;

  const GO_BUILD_CACHE_COORDINATION_HEARTBEAT_MS = 5_000;

  /**
   * Create and pin the owned Go cache to an ordinary physical directory.
   *
   * The leaf may be user-controlled inside `node_modules/.cache`; accepting a
   * symlink or junction there would let LRU deletion escape into an arbitrary
   * two-hex directory. Returning the canonical spelling also keeps the build,
   * leases, and maintenance on the same directory if an ancestor alias moves.
   */
  export function canonicalGoBuildCacheRoot(root: string): string {
    fs.mkdirSync(root, { recursive: true });
    const physicalParent = fs.realpathSync.native(path.dirname(root));
    const stats = fs.lstatSync(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`ttsc: unsafe Go build cache root: ${root}`);
    }
    const physicalRoot = fs.realpathSync.native(root);
    if (path.dirname(physicalRoot) !== physicalParent) {
      throw new Error(`ttsc: Go build cache root escaped its parent: ${root}`);
    }
    return physicalRoot;
  }

  /** One published build or maintenance record, owned by this process. */
  export interface GoBuildCacheCoordinationRecord {
    /** Path of the record file. */
    file: string;
    /**
     * Stop the heartbeat, mark the record complete, then delete it. Completion is
     * persisted first so a failed delete never leaves a finished task looking
     * active until it expires.
     */
    finish: () => void;
    /**
     * Keep the record fresh from a background worker while this thread blocks in
     * a synchronous build. Idempotent; returns `false` when no worker could be
     * started (the record then relies on its stale timeout).
     */
    startHeartbeat: () => boolean;
  }

  /**
   * Publish an `active` record for this process in the coordination directory
   * `directoryName` of the cache at `root`.
   */
  export function createGoBuildCacheCoordinationRecord(
    root: string,
    directoryName: string,
  ): GoBuildCacheCoordinationRecord {
    const directory = goBuildCacheCoordinationDirectory(
      root,
      directoryName,
      true,
    )!;
    const record = path.join(
      directory,
      `${process.pid}-${crypto.randomBytes(16).toString("hex")}.json`,
    );
    const metadata = {
      directoryName,
      hostname: os.hostname(),
      pid: process.pid,
      startedAt: Date.now(),
    };
    writeGoBuildCacheCoordinationRecord(record, metadata, "active");
    let heartbeat: GoBuildCacheHeartbeat | undefined;
    return {
      file: record,
      finish: () => {
        heartbeat?.stop();
        heartbeat = undefined;
        // A failed unlink must not leave a completed task looking active until
        // its stale timeout. Persist completion first; collectors discard it.
        try {
          writeGoBuildCacheCoordinationRecord(record, metadata, "complete");
        } catch {}
        try {
          fs.rmSync(record, { force: true });
        } catch {}
      },
      startHeartbeat: () => {
        heartbeat ??= startGoBuildCacheHeartbeat(record);
        return heartbeat !== undefined;
      },
    };
  }

  function writeGoBuildCacheCoordinationRecord(
    file: string,
    metadata: {
      directoryName: string;
      hostname: string;
      pid: number;
      startedAt: number;
    },
    status: "active" | "complete",
  ): void {
    SourceBuildCacheLayout.replaceCacheMetadataFile(
      file,
      `${JSON.stringify({ ...metadata, status, version: 1 })}\n`,
    );
  }

  interface GoBuildCacheHeartbeat {
    stop: () => void;
  }

  /** Refresh one synchronous cache task's record from a background worker. */
  function startGoBuildCacheHeartbeat(
    file: string,
  ): GoBuildCacheHeartbeat | undefined {
    const control = new SharedArrayBuffer(4);
    const state = new Int32Array(control);
    try {
      const worker = new Worker(
        [
          'const fs = process.getBuiltinModule("node:fs");',
          'const { workerData } = process.getBuiltinModule("node:worker_threads");',
          "const state = new Int32Array(workerData.control);",
          "for (;;) {",
          "  const result = Atomics.wait(state, 0, 0, workerData.interval);",
          '  if (result !== "timed-out" || Atomics.load(state, 0) !== 0) break;',
          "  try {",
          "    const now = new Date();",
          "    fs.utimesSync(workerData.file, now, now);",
          "  } catch {}",
          "}",
        ].join("\n"),
        {
          eval: true,
          workerData: {
            control,
            file,
            interval: GO_BUILD_CACHE_COORDINATION_HEARTBEAT_MS,
          },
        },
      );
      worker.unref();
      return {
        stop: () => {
          Atomics.store(state, 0, 1);
          Atomics.notify(state, 0);
          void worker.terminate();
        },
      };
    } catch {}

    // Node's permission model can deny Worker construction while still allowing
    // the child process required for `go build`. The fallback inherits only the
    // low standard descriptors and checks its parent PID. An IPC channel would
    // allocate another high descriptor and recreate Darwin's spawn EBADF limit.
    try {
      const child = spawn(
        process.execPath,
        [
          "-e",
          [
            'const fs = require("node:fs");',
            "const file = process.argv[1];",
            "const interval = Number(process.argv[2]);",
            "const parent = Number(process.argv[3]);",
            "const timer = setInterval(() => {",
            "  try { process.kill(parent, 0); } catch { clearInterval(timer); process.exit(0); }",
            "  try {",
            "    const now = new Date();",
            "    fs.utimesSync(file, now, now);",
            "  } catch {}",
            "}, interval);",
          ].join("\n"),
          file,
          String(GO_BUILD_CACHE_COORDINATION_HEARTBEAT_MS),
          String(process.pid),
        ],
        {
          stdio: [0, 1, 2],
          windowsHide: true,
        },
      );
      child.unref();
      return {
        stop: () => {
          child.kill();
        },
      };
    } catch {
      return undefined;
    }
  }

  /**
   * The live records of one coordination directory at `now`. Completed, stale, or
   * unreadable records are deleted as they are found, so the directory does not
   * grow with every crashed process.
   */
  export function collectLiveGoBuildCacheCoordinationRecords(
    root: string,
    directoryName: string,
    now: number,
  ): string[] {
    const directory = goBuildCacheCoordinationDirectory(
      root,
      directoryName,
      false,
    );
    if (directory === undefined) return [];
    let records: fs.Dirent[];
    try {
      records = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const live: string[] = [];
    for (const record of records) {
      if (!record.isFile()) {
        continue;
      }
      const file = path.join(directory, record.name);
      if (goBuildCacheCoordinationRecordIsLive(file, directoryName, now)) {
        live.push(file);
        continue;
      }
      try {
        fs.rmSync(file, { force: true });
      } catch {}
    }
    return live;
  }

  /**
   * Resolve one private coordination directory without following a project-
   * supplied symlink or junction outside the owned Go cache.
   */
  function goBuildCacheCoordinationDirectory(
    root: string,
    directoryName: string,
    create: boolean,
  ): string | undefined {
    if (create) fs.mkdirSync(root, { recursive: true });
    const directory = path.join(root, directoryName);
    if (create) {
      try {
        fs.mkdirSync(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(directory);
    } catch (error) {
      if (!create && (error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(
        `ttsc: unsafe Go build cache coordination directory: ${directory}`,
      );
    }
    const physicalRoot = fs.realpathSync.native(root);
    const physicalDirectory = fs.realpathSync.native(directory);
    if (path.dirname(physicalDirectory) !== physicalRoot) {
      throw new Error(
        `ttsc: Go build cache coordination directory escaped its root: ${directory}`,
      );
    }
    return physicalDirectory;
  }

  function goBuildCacheCoordinationRecordIsLive(
    file: string,
    directoryName: string,
    now: number,
  ): boolean {
    let contents: string | undefined;
    try {
      contents = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(contents) as Record<string, unknown>;
      if (parsed.status === "complete") return false;
      // Parse valid records for forward compatibility, but do not equate a PID's
      // lifetime with one task. A failed unlink can leave a record owned by a
      // still-running Vite process, while a dead Node parent can leave its
      // spawnSync Go child alive. The heartbeat/grace below models the task.
      void parsed;
    } catch {}
    try {
      const age = now - fs.statSync(file).mtimeMs;
      if (age < -GO_BUILD_CACHE_COORDINATION_CLOCK_SKEW_MS) {
        // A restored cache can carry a far-future timestamp, but the same state
        // also occurs when the system clock moves backward during a real build.
        // Rebase the record and grant one ordinary grace period; an active
        // heartbeat keeps refreshing it, while an orphan then expires normally.
        // Treat a failed rebase as live too: the safe failure mode is to defer
        // opportunistic maintenance, never to delete under a possibly live Go.
        // Replace the directory entry rather than changing its inode in place.
        // A restored or user-modified cache can contain a hard-linked record;
        // utimesSync(file) would then mutate metadata outside the owned cache.
        if (contents !== undefined) {
          try {
            SourceBuildCacheLayout.replaceCacheMetadataFile(file, contents);
          } catch {}
        }
        return true;
      }
      const staleMs =
        directoryName === GO_BUILD_CACHE_MAINTENANCE_DIR
          ? GO_BUILD_CACHE_MAINTENANCE_STALE_MS
          : GO_BUILD_CACHE_COORDINATION_STALE_MS;
      return age <= staleMs;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== "ENOENT";
    }
  }
}
