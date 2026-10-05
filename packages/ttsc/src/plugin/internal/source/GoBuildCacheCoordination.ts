import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";

import { E2ETrace } from "../../../internal/E2ETrace";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Coordination between Go builds that use ttsc's own Go object cache and the
 * opportunistic pruning of that cache.
 *
 * Coordinated build and admitted maintenance attempts publish records in
 * private cache directories and attempt heartbeat startup. Pruning skips the
 * cohort a live build may still read, and an abandoned record expires after a
 * grace period (one hour for builds, one minute for maintenance). Byte-read
 * failure still permits age-based expiry when metadata is readable; unknown age
 * or failed clock-skew repair defers pruning conservatively. This is
 * opportunistic coordination rather than an absolute proof that every abandoned
 * record can be reclaimed.
 *
 * Age-based expiry assumes a running task can keep its heartbeat fresh. A
 * prolonged suspension or failed heartbeat after startup can outlast the grace;
 * elapsed time alone does not prove that its Go process has ended.
 *
 * @evidence contracts/common.md#principled-implementation Published completion and refreshed mtimes implement task policy: build grace is one hour and maintenance grace one minute. Unknown metadata age defers pruning, while unreadable bytes can still expire by observed age; grace expiry is not process-absence proof after heartbeat failure.
 * @evidence contracts/common.md#clear-and-simple-design Root validation, task publication and collection form one coordination boundary used by builders and maintenance.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Time windows are documented coordination policy; worker/process alternatives address actual synchronous-build and native spawn constraints rather than known fixtures.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains lease purpose and conservative unreadable/clock-skew limits; function and member comments describe release and startup outcomes.
 * @evidence contracts/portability.md#os-neutral-implementation Native filesystem metadata and Node worker/process APIs provide the boundary without assuming an OS's case policy.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups member-owned processing strategies and performs no scan itself.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Namespace membership establishes no computed-result identity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Actual records and workers are owned by create/finish operations rather than the namespace declaration.
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
   * Create the owned Go cache and return its observed physical directory
   * spelling.
   *
   * The leaf may be user-controlled inside `node_modules/.cache`; accepting a
   * symlink or junction there would let LRU deletion escape into an arbitrary
   * two-hex directory. Returning the canonical spelling also keeps the build,
   * leases, and maintenance address that spelling if an ancestor alias moves.
   * These sequential observations do not retain a directory handle or prevent
   * later physical-path replacement.
   *
   * @evidence contracts/common.md#principled-implementation lstat rejects aliased leaves and physical parent validation confines the returned Go root to its resolved parent before deletion or builds use it.
   * @evidence contracts/common.md#clear-and-simple-design Validation returns one physical spelling or throws, so consumers do not carry partially safe paths.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native filesystem facts establish ownership boundaries, not guessed cache names or foreign API mutation.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain project-controlled leaf risk, ancestor-alias spelling resolution and the absence of a retained directory handle.
   * @evidence contracts/portability.md#os-neutral-implementation Native realpath/lstat preserve actual identity; no Windows-name check supplies volume case semantics.
   * @evidence contracts/performance.md#efficient-algorithms Fixed metadata calls validate the leaf; path resolution and recursive creation scale with ancestor depth.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Mutable aliases are checked per operation rather than cached without an invalidation witness.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Validation opens no persistent handle and owns no cache entries.
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

  /**
   * One published build or maintenance record, owned by this process.
   *
   * @evidence contracts/common.md#principled-implementation Record identity and lifecycle callbacks represent the same owned task; completion cannot be mistaken for another task's lease.
   * @evidence contracts/common.md#clear-and-simple-design The interface exposes only its published path, startup and terminal release.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The callbacks are explicit ownership operations, not mutation of external worker APIs.
   * @evidence contracts/common.md#meaningful-documentation Member prose explains terminal completion, startup failure and synchronous-build purpose with blank-separated fields.
   * @evidence contracts/portability.md#os-neutral-implementation The path denotes a native coordination file while callbacks hide worker versus process startup differences.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This interface declares an ownership capability and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The interface is not a computed-result coordinator.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Actual acquisition and release are performed by the factory and callbacks, not this type declaration.
   */
  export interface GoBuildCacheCoordinationRecord {
    /** Path of the record file. */
    file: string;

    /**
     * Request heartbeat shutdown, attempt to mark the record complete, then
     * attempt deletion. Shutdown is not joined and failures may leave a task or
     * file. A successful completion write prevents a failed delete from leaving
     * the task active; if both writes and deletion fail, stale-timeout handling
     * remains the collector's fallback.
     *
     * @evidence contracts/common.md#principled-implementation The terminal callback requests refresher shutdown and attempts complete-state publication before removal; only successful publication records completion if deletion fails, and task termination is not joined.
     * @evidence contracts/common.md#clear-and-simple-design Release is one idempotent operation and prevents later heartbeat restart.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Completion persistence addresses a real failed-unlink state rather than simulating successful cleanup.
     * @evidence contracts/common.md#meaningful-documentation Native prose states ordering and its failure consequence, separated from tags.
     * @evidence contracts/portability.md#os-neutral-implementation Native worker termination and file removal failures are encapsulated by the owning callback.
     * @evidence contracts/performance.md#efficient-algorithms Release performs fixed task-control and atomic metadata/removal operations without scanning cache contents; costs include stored path and host/PID metadata bytes and native filesystem resolution.
     *
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work This callback closes one owned task, not a reusable computation.
     *
     * @evidence contracts/performance.md#bound-retention-and-release-resources Finish requests worker termination or child kill without joining it, then attempts completion publication/removal. Failed removal is marked complete only if publication succeeds; otherwise age/uncertainty policy may retain the record, and terminal state prevents another cleanup attempt through this capability.
     */
    finish: () => void;

    /**
     * Keep the record fresh from a background refresher while this thread
     * blocks in a synchronous build. Successful startup is reused; failed
     * startup can be attempted again. Returns `false` when no mechanism could
     * initialize during readiness checks (the record then relies on age
     * policy). Repeated calls reuse the startup-acknowledged capability without
     * proving the refresher is still healthy. Finished records cannot be
     * restarted.
     *
     * @evidence contracts/common.md#principled-implementation Initialization acknowledgement is required before the callback reports an independently refreshing task; a completed record has no restart capability.
     * @evidence contracts/common.md#clear-and-simple-design Lazy initialization stores one acknowledged refresher capability per unfinished record, separately from terminal finish state.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Worker and low-descriptor child paths support actual runtime capability differences, not fixture-specific outcomes.
     * @evidence contracts/common.md#meaningful-documentation Native prose names synchronous-build purpose, acknowledged-capability reuse, retryable initialization failure and terminal-state behavior.
     * @evidence contracts/portability.md#os-neutral-implementation Node workers or the current Node executable provide native background work without shell command quoting.
     * @evidence contracts/performance.md#efficient-algorithms Repeated starts reuse the stored startup-acknowledged capability. First startup attempts a worker and, if unavailable, a Node child; timed readiness waits have a grace per mechanism, while construction/native file observations add their own duration. Child script/argument bytes and readiness-path checks contribute to startup cost.
     *
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work Reusing a heartbeat capability is lifecycle ownership, not equivalent build-result reuse.
     *
     * @evidence contracts/performance.md#bound-retention-and-release-resources One successful refresher capability is stored per record; failed worker termination may overlap child fallback. Startup/finish request termination without joining, and ready-file deletion is best-effort. A later failed refresher is not recreated by repeating start; record expiry follows the declared freshness policy.
     */
    startHeartbeat: () => boolean;
  }

  /**
   * Publish an `active` record for this process in the coordination directory
   * `directoryName` of the cache at `root`.
   *
   * @evidence contracts/common.md#principled-implementation A random process-qualified record distinguishes concurrent tasks, atomic metadata publishes active/complete states and terminal finish prevents restart.
   * @evidence contracts/common.md#clear-and-simple-design Returned callbacks close over exactly one record, heartbeat and terminal flag rather than a global task registry.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Random uniqueness and completion-before-unlink address real concurrent publication and cleanup failures; no consumer identity is privileged.
   * @evidence contracts/common.md#meaningful-documentation Native type/member comments describe ownership and release semantics while the factory identifies the publication location.
   * @evidence contracts/portability.md#os-neutral-implementation Native path, hostname and atomic entry publication identify the local task without assuming PID meaning on another host.
   * @evidence contracts/performance.md#efficient-algorithms Publication validates native coordination paths and atomically writes one host/PID/status record, with path/JSON-byte costs. Startup is lazy and shares the stored capability; it includes worker construction or child launch/readiness observations rather than just record writes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A task lease is not a cached build answer; producer identity and lock sharing belong to the build owner.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller receives one record and lazy refresher capability and must call finish after its synchronous task. Termination is requested without joining; failed startup can overlap fallback, and failed completion/removal can leave records governed by age/uncertainty policy. This factory imposes no cross-task population bound.
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
    let finished = false;
    return {
      file: record,
      finish: () => {
        if (finished) return;
        finished = true;
        try {
          heartbeat?.stop();
        } catch {
          // Native termination failure must not skip completion publication.
        }
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
        if (finished) return false;
        heartbeat ??= startGoBuildCacheHeartbeat(record);
        return heartbeat !== undefined;
      },
    };
  }

  /** Publish a complete coordination state through the shared atomic writer. */
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

  /** The sole release capability for one background refresher. */
  interface GoBuildCacheHeartbeat {
    /** Terminate this refresher without retaining the parent process. */
    stop: () => void;
  }

  /**
   * Refresh one synchronous task independently of the blocked parent thread.
   *
   * Initialization is acknowledged before success. Later inaccessible record
   * writes can still stop freshness, so collection retains its conservative
   * grace and uncertainty policy rather than claiming perfect liveness.
   */
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
          "Atomics.store(state, 0, 1);",
          "Atomics.notify(state, 0);",
          "for (;;) {",
          "  const result = Atomics.wait(state, 0, 1, workerData.interval);",
          '  if (result !== "timed-out" || Atomics.load(state, 0) !== 1) break;',
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
      worker.on("error", () => {
        Atomics.store(state, 0, 2);
        Atomics.notify(state, 0);
      });
      worker.unref();
      Atomics.wait(state, 0, 0, GO_BUILD_CACHE_COORDINATION_HEARTBEAT_MS);
      if (Atomics.load(state, 0) === 1) {
        return {
          stop: () => {
            Atomics.store(state, 0, 2);
            Atomics.notify(state, 0);
            void worker.terminate();
          },
        };
      }
      Atomics.store(state, 0, 2);
      Atomics.notify(state, 0);
      void worker.terminate();
    } catch {}

    // Node's permission model can deny Worker construction while still allowing
    // the child process required for `go build`. The fallback inherits only the
    // low standard descriptors and checks its parent PID. An IPC channel would
    // allocate another high descriptor and recreate Darwin's spawn EBADF limit.
    const ready = `${file}.heartbeat-${crypto.randomBytes(16).toString("hex")}`;
    let heartbeatChild: ReturnType<typeof spawn> | undefined;
    try {
      const heartbeatArgs = [
        "-e",
        [
          'const fs = require("node:fs");',
          "const file = process.argv[1];",
          "const interval = Number(process.argv[2]);",
          "const parent = Number(process.argv[3]);",
          "const ready = process.argv[4];",
          "const timer = setInterval(() => {",
          "  try { process.kill(parent, 0); } catch { clearInterval(timer); process.exit(0); }",
          "  try {",
          '    if (JSON.parse(fs.readFileSync(file, "utf8")).status === "complete") {',
          "      clearInterval(timer); process.exit(0);",
          "    }",
          "    const now = new Date();",
          "    fs.utimesSync(file, now, now);",
          '  } catch (error) { if (error.code === "ENOENT") { clearInterval(timer); process.exit(0); } }',
          "}, interval);",
          'try { fs.writeFileSync(ready, "ready", { flag: "wx" }); }',
          "catch { clearInterval(timer); process.exit(1); }",
        ].join("\n"),
        file,
        String(GO_BUILD_CACHE_COORDINATION_HEARTBEAT_MS),
        String(process.pid),
        ready,
      ];
      const trace = E2ETrace.begin(
        process.execPath,
        heartbeatArgs,
        {},
        "go-cache-heartbeat",
      );
      const child = spawn(process.execPath, heartbeatArgs, {
        stdio: [0, 1, 2],
        windowsHide: true,
      });
      E2ETrace.asynchronous(trace, child);
      heartbeatChild = child;
      child.on("error", () => {
        // spawn reports OS launch failures asynchronously, outside this try.
      });
      child.unref();
      if (child.pid === undefined) return undefined;
      const deadline =
        performance.now() + GO_BUILD_CACHE_COORDINATION_HEARTBEAT_MS;
      while (!fs.existsSync(ready)) {
        if (performance.now() >= deadline) {
          child.kill();
          return undefined;
        }
        Atomics.wait(state, 0, Atomics.load(state, 0), 10);
      }
      return {
        stop: () => {
          child.kill();
        },
      };
    } catch {
      try {
        heartbeatChild?.kill();
      } catch {}
      return undefined;
    } finally {
      try {
        fs.rmSync(ready, { force: true });
      } catch {}
    }
  }

  /**
   * The live records of one coordination directory at `now`. Completed and
   * age-policy-stale records have deletion attempted; inaccessible metadata is
   * retained when its age cannot be established safely.
   *
   * @evidence contracts/common.md#principled-implementation Complete status overrides age; ordinary records beyond the declared age policy have removal attempted. Unknown metadata age or far-future clock observations preserve possible work, while unreadable content alone does not prevent age-based expiry.
   * @evidence contracts/common.md#clear-and-simple-design One snapshot feeds a liveness helper and best-effort removal, returning only the protected paths.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts PID lifetime is not substituted for task lifetime; actual task status and heartbeat age drive selection.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes completed/stale reclamation from inaccessible metadata retention.
   * @evidence contracts/portability.md#os-neutral-implementation Native Dirents select ordinary files and sequential lstat/realpath checks validate the coordination directory's observed spelling; no directory handle prevents later replacement.
   * @evidence contracts/performance.md#efficient-algorithms One listing and per-selected-record JSON/mtime reads scale with entry names, path strings and metadata bytes, with arrays retaining entry/path text. Future-clock rebasing can add atomic metadata writes, and stale/complete cleanup adds native removals; directory validation adds native resolution without scanning unrelated cache payloads.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Liveness is time-sensitive and filesystem-mutating collection is not memoized.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Completed and stale records are reclaimed; unknown state or failed deletion can retain metadata beyond the normal grace.
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

  /** Classify task freshness without deleting under uncertain native state. */
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
