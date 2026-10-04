import { type ChildProcess } from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const { spawn } = E2eProcessTrace;
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { IRunResult } from "../../../../../utils/src/evidence/IRunResult";
import type { IWatchSession } from "./IWatchSession";
import { EvidenceProcessOwnership } from "../../../../../utils/src/evidence/EvidenceProcessOwnership";
import { pluginCacheDirectory } from "../../../../../utils/src/evidence/pluginCacheDirectory";
import { resolveDependency } from "../../../../../utils/src/evidence/resolveDependency";

/** Terminates one rebuild, whichever way it ended. */
const BUILD_MARKER = /\[ttsc\] watch build (complete|failed)\r?\n/g;

/**
 * Generous because the FIRST run of a cache key statically links this package's
 * Go into the lint binary. `runCheck` documents the same allowance.
 */
export const FIRST_BUILD_TIMEOUT: number = 900_000;

/** A rebuild in a warm session is a Program update, not a link. */
const REBUILD_TIMEOUT: number = 120_000;

/**
 * Starts `ttsc check --watch` against a fixture and returns a driveable
 * session.
 *
 * `--preserveWatchOutput` is required rather than cosmetic: without it the
 * launcher writes `\x1bc` before each rebuild to clear the terminal, and a test
 * reading the pipe would be asserting against a transcript that erases itself.
 *
 * `TTSC_WATCH_DEBUG_INPUTS` turns on the launcher's report of which roots it
 * watches and which changes it announced. A watch that never fires and a watch
 * that fired and decided the change was irrelevant produce the same silence, so
 * without this a failing freshness case could not say which one happened.
 *
 * `diagnostics` adds `@ttsc/lint`'s resident-check telemetry to each rebuild,
 * which is the only channel that distinguishes a Program reused across cycles
 * from one reloaded every time. Freshness and residency are separate
 * properties, and a rebuild that discards the Program satisfies every freshness
 * case in this suite while being the regression that makes watch mode useless.
 *
 * Shutdown uses the launcher's inherited IPC channel. A nonce-bound stopped
 * response confirms its owning native sessions and active cycle were joined;
 * cleanup additionally requires actual launcher/stdio closure and agreement
 * between the response, final build marker and exit status. Ordinary callers
 * finish a build before closing, so a response with no completed status fails.
 * A launcher that ignores the request is not retried: the failure reports its
 * process state, CPU ticks, children and descriptors sampled at the request and
 * at the deadline, with the output no build consumed.
 *
 * @evidence contracts/common.md#principled-implementation Build terminators advance one transcript cursor; startup/exit failures reject observations. Shutdown requires the owning launcher's nonce-bound joined response, its last completed 0/2 marker and matching actual close status. Signal, forced, missing-response or mismatched closure permanently retains fixture inputs; Node exit alone supplies no descendant authority.
 * @evidence contracts/common.md#clear-and-simple-design One owner exposes cycle, quiet-window and shutdown operations; notification bookkeeping is local and shutdown has one memoized operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Real Node launcher/native watcher execution is preserved without foreign method replacement, fabricated cycle success or termination retries that hide a live child.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains output preservation, watch-input diagnostics, resident telemetry and why shutdown needs both the owning joined response and real launcher closure; no-completed-build responses are outside these callers' lifecycle; the unstopped-launcher report states what is sampled and that it is Linux-only.
 * @evidence contracts/portability.md#os-neutral-implementation Node spawns an executable plus argv without a shell; its real IPC channel requests graceful owning cleanup on Windows and POSIX rather than assuming signal delivery executes a JavaScript handler. Forced signals and actual close events still expose failure; fixture paths are native paths and protocol markers remain text.
 * @evidence contracts/performance.md#efficient-algorithms Marker searches start at the consumed cursor, while output append and diagnostic slices scale with transcript bytes; notifying current waiters scales with outstanding observations.
 * @evidence contracts/performance.md#reuse-equivalent-work One live watcher and cached native contributor serve successive changed Program cycles; memoized close requests share the same termination and join rather than starting duplicate shutdown work.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The owner retains one child and a full transcript until the session is discarded; wait callbacks remove themselves on timer/output settlement. Memoized close removes its IPC/close listeners and timers, while unknown signal/forced/missing-or-invalid-response closure retains fixture and existing shared producer/cache inputs. Only the owning joined receipt plus observed close admits cleanup. Transcript bytes are not capped.
 */
export const startWatch = (
  directory: string,
  options: { readonly diagnostics?: boolean } = {},
): IWatchSession => {
  EvidenceProcessOwnership.assertAvailable(directory);
  const launcher: string = path.join(
    resolveDependency("ttsc"),
    "lib",
    "launcher",
    "ttsc.js",
  );
  const child: ChildProcess = spawn(
    process.execPath,
    [
      launcher,
      "check",
      "--watch",
      "--preserveWatchOutput",
      ...(options.diagnostics === true ? ["--diagnostics"] : []),
      "-p",
      "tsconfig.json",
    ],
    {
      cwd: directory,
      env: {
        ...process.env,
        TTSC_CACHE_DIR: pluginCacheDirectory(directory),
        TTSC_WATCH_DEBUG_INPUTS: "1",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );

  let text: string = "";
  let cursor: number = 0;
  let exited: boolean = false;
  let closed: boolean = false;
  let startupError: Error | undefined;
  let closeOperation: Promise<void> | undefined;
  let acknowledgedStopStatus: number | undefined;
  const wake = new Set<() => void>();
  const notify = (): void => {
    const waiting = [...wake];
    wake.clear();
    for (const resume of waiting) resume();
  };
  const retirementTails = { stdout: "", stderr: "" };
  let retirementFailed = false;
  const absorb = (stream: "stdout" | "stderr", chunk: string): void => {
    const input = retirementTails[stream] + chunk;
    retirementTails[stream] = input.slice(-128);
    if (
      !retirementFailed &&
      /(?:^|\n)ttsc: resident check retirement failed\r?\n/.test(input)
    ) {
      retirementFailed = true;
      EvidenceProcessOwnership.retain(
        directory,
        new Error("The launcher could not join its retired native check host."),
      );
    }
    text += chunk;
    notify();
  };
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => absorb("stdout", chunk));
  child.stderr?.on("data", (chunk: string) => absorb("stderr", chunk));
  child.on("error", (error: Error) => {
    startupError = error;
    EvidenceProcessOwnership.retain(directory, error);
    notify();
  });
  child.on("close", (code, signal) => {
    closed = true;
    const lastMarker = [...text.matchAll(/\[ttsc\] watch build (complete|failed)\r?\n/g)].at(-1);
    const lastStatus = lastMarker === undefined ? undefined : lastMarker[1] === "failed" ? 2 : 0;
    if (acknowledgedStopStatus === undefined || acknowledgedStopStatus !== lastStatus || code !== acknowledgedStopStatus || signal !== null)
      EvidenceProcessOwnership.retain(directory, new Error(
        "Watch launcher closure does not establish joined native descendants.",
        { cause: { code, signal } },
      ));
    notify();
  });
  child.on("exit", () => {
    exited = true;
    notify();
  });

  const slice = (from: number, to: number, status: number): IRunResult => {
    const output: string = text.slice(from, to);
    return { status, stdout: output, stderr: "", output };
  };

  /** Finds the first build terminator at or after the cursor. */
  const findBuild = (): IRunResult | null => {
    BUILD_MARKER.lastIndex = cursor;
    const match: RegExpExecArray | null = BUILD_MARKER.exec(text);
    if (match === null) return null;
    const end: number = match.index + match[0].length;
    const result: IRunResult = slice(
      cursor,
      end,
      match[1] === "failed" ? 2 : 0,
    );
    cursor = end;
    return result;
  };

  /**
   * Resolves once `settled` returns a value, the process dies, or time runs
   * out.
   */
  const until = async <T>(
    settled: () => T | null,
    timeout: number,
    describe: string,
  ): Promise<T> => {
    const deadline: number = Date.now() + timeout;
    for (;;) {
      EvidenceProcessOwnership.assertAvailable(directory);
      const value: T | null = settled();
      if (value !== null) return value;
      if (startupError !== undefined) throw startupError;
      if (exited)
        throw new Error(
          `${describe}, but the watch process exited first.\n\nTranscript:\n${text}`,
        );
      const remaining: number = deadline - Date.now();
      if (remaining <= 0)
        throw new Error(
          `${describe} within ${timeout} ms.\n\nTranscript:\n${text}`,
        );
      await new Promise<void>((resolve) => {
        const resume = (): void => {
          clearTimeout(timer);
          wake.delete(resume);
          resolve();
        };
        const timer = setTimeout(resume, Math.min(remaining, 50));
        wake.add(resume);
      });
    }
  };

  return {
    nextBuild: (timeout: number = REBUILD_TIMEOUT): Promise<IRunResult> =>
      until(findBuild, timeout, "Expected the watcher to finish a rebuild"),
    expectNoBuild: async (milliseconds: number): Promise<IRunResult> => {
      EvidenceProcessOwnership.assertAvailable(directory);
      const from: number = cursor;
      await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
      if (startupError !== undefined) throw startupError;
      if (exited || closed)
        throw new Error("The watcher exited during the no-build observation.");
      const seen: IRunResult = slice(from, text.length, 0);
      // The launcher prints this the moment a rebuild starts, so it catches a
      // spurious wake even when the rebuild has not finished within the window.
      if (seen.output.includes("[ttsc] rebuilding at"))
        throw new Error(
          `Expected no rebuild within ${milliseconds} ms.\n\nActual output:\n${seen.output}`,
        );
      cursor = text.length;
      return seen;
    },
    close: (): Promise<void> => {
      if (closeOperation !== undefined) return closeOperation;
      if (closed) {
        try {
          EvidenceProcessOwnership.assertAvailable(directory);
          return (closeOperation = Promise.resolve());
        } catch (error) {
          return (closeOperation = Promise.reject(error));
        }
      }
      closeOperation = new Promise<void>((resolve, reject) => {
        const id = randomUUID();
        let force: NodeJS.Timeout | undefined;
        let deadline: NodeJS.Timeout | undefined;
        let settled = false;
        let atStop: string | undefined;
        let recordedDescendants: ReturnType<typeof sampleShutdownDescendants> | undefined;
        const sampleAtDeadline = (): string => sampleLauncher(child.pid) +
          " Recorded shutdown process tree now: " +
          (recordedDescendants
            ? sampleShutdownDescendants(child.pid, recordedDescendants.identities).snapshot
            : "(not sampled)");
        const settle = (success: boolean, error?: unknown): void => {
          if (settled) return;
          settled = true;
          if (force !== undefined) clearTimeout(force);
          if (deadline !== undefined) clearTimeout(deadline);
          child.removeListener("close", onClose);
          child.removeListener("message", onMessage);
          if (success) {
            try {
              EvidenceProcessOwnership.assertAvailable(directory);
              resolve();
            } catch (failure) {
              reject(failure);
            }
          } else {
            EvidenceProcessOwnership.retain(directory, error);
            reject(error);
          }
        };
        const onClose = (): void => settle(true);
        const onMessage = (value: unknown): void => {
          if (typeof value !== "object" || value === null) return;
          const message = value as Record<string, unknown>;
          if (message.type !== "ttsc.watch.stopped" || message.id !== id) return;
          if (message.status !== 0 && message.status !== 2) {
            settle(false, new Error("The watcher returned an invalid joined shutdown status."));
            return;
          }
          acknowledgedStopStatus = message.status;
          try {
            if (child.connected) child.disconnect();
          } catch (error) {
            settle(false, error);
          }
        };
        child.once("close", onClose);
        child.on("message", onMessage);
        // The IPC receipt is owning join authority, not an exit observation.
        // Every success also joins launcher close;
        // every failure removes this shutdown owner's listener and timers.
        deadline = setTimeout(() => {
          settle(false, new Error(
            "The watch child did not close after termination.\n" +
              describeUnstoppedLauncher(atStop, sampleAtDeadline(), text.slice(cursor)),
          ));
        }, 20_000);
        try {
          if (child.exitCode === null && child.signalCode === null) {
            if (!child.connected) throw new Error("The watch child has no owning shutdown channel.");
            recordedDescendants = sampleShutdownDescendants(child.pid);
            atStop = sampleLauncher(child.pid) + " Rooted shutdown process tree: " + recordedDescendants.snapshot;
            child.send({ type: "ttsc.watch.stop", id }, (error) => {
              if (error) settle(false, error);
            });
            if (!settled)
              force = setTimeout(() => {
                if (closed) return;
                EvidenceProcessOwnership.retain(directory, new Error(
                  "Watch shutdown required forced launcher termination.\n" +
                    describeUnstoppedLauncher(atStop, sampleAtDeadline(), text.slice(cursor)),
                ));
                try {
                  child.kill("SIGKILL");
                } catch (error) {
                  settle(false, error);
                }
              }, 10_000);
          }
          if (closed) onClose();
        } catch (error) {
          settle(false, error);
        }
      });
      return closeOperation;
    },
  };
};

/** Output a failure report keeps from the launcher's last unconsumed transcript. */
const UNSTOPPED_TRANSCRIPT_LIMIT: number = 4_000;

/**
 * Report what a launcher that ignored its shutdown request was doing.
 *
 * Both samples are taken by the harness, so a launcher that is blocked, busy or
 * waiting can be told apart without its cooperation: CPU time advancing between
 * the request and the deadline means work, an unchanged sleeping state means a
 * wait on a child or handle, and the transcript shows what it last printed.
 * Only Linux exposes the process tables read here; elsewhere the samples are
 * empty and the transcript alone is reported.
 */
function describeUnstoppedLauncher(
  atStop: string | undefined,
  atDeadline: string,
  unconsumed: string,
): string {
  return [
    "Launcher at the shutdown request: " + (atStop || "(not sampled)"),
    "Launcher now: " + (atDeadline || "(not sampled)"),
    "Launcher output not yet consumed by a build:",
    unconsumed.length <= UNSTOPPED_TRANSCRIPT_LIMIT
      ? unconsumed
      : "..." + unconsumed.slice(-UNSTOPPED_TRANSCRIPT_LIMIT),
  ].join("\n");
}

/** State, CPU ticks, wait channel, children and descriptors of one process. */
function sampleLauncher(pid: number | undefined): string {
  if (pid === undefined || process.platform !== "linux") return "";
  const read = (file: string): string => {
    try {
      return fs.readFileSync(file, "utf8").trim();
    } catch {
      return "";
    }
  };
  const stat = read("/proc/" + pid + "/stat");
  // Fields follow the parenthesized command name: state is the first, user and
  // system CPU ticks the twelfth and thirteenth after it.
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  const children = read("/proc/" + pid + "/task/" + pid + "/children")
    .split(" ")
    .filter((child) => child !== "")
    .map((child) => child + "=" + read("/proc/" + child + "/cmdline").replaceAll("\0", " ").slice(0, 120));
  let descriptors: string[] = [];
  try {
    descriptors = fs.readdirSync("/proc/" + pid + "/fd").map((fd) => {
      try {
        return fd + "->" + fs.readlinkSync("/proc/" + pid + "/fd/" + fd);
      } catch {
        return fd;
      }
    });
  } catch {
    // The process may have exited between the sample and the listing.
  }
  return JSON.stringify({
    state: fields[0],
    utime: fields[11],
    stime: fields[12],
    wchan: read("/proc/" + pid + "/wchan"),
    children,
    descriptors,
  });
}

/**
 * Keeps a bounded Linux process-tree witness before the launcher disappears.
 * Later samples revisit only those recorded PIDs and compare start ticks; a
 * recycled PID cannot stand in for the original descendant. Raw descriptor
 * links expose possible inherited pipes without certifying their ownership or
 * process termination. Missing reads and all population caps remain explicit.
 */
function sampleShutdownDescendants(
  pid: number | undefined,
  recorded?: Map<number, string>,
): { identities: Map<number, string>; snapshot: string } {
  const identities = new Map<number, string>();
  if (process.platform !== "linux" || pid === undefined)
    return { identities, snapshot: "(Linux process-tree observation unavailable)" };
  const queue = recorded ? [...recorded.keys()] : [pid];
  const visited = new Set<number>();
  const records: Record<string, unknown>[] = [];
  let truncated = false;
  let retainedCharacters = 0;
  const read = (file: string): string => {
    try { return fs.readFileSync(file, "utf8").trim(); }
    catch (error) { return "unavailable: " + String(error); }
  };
  for (let index = 0; index < queue.length && visited.size < 64; ++index) {
    const current = queue[index];
    if (visited.has(current)) continue;
    visited.add(current);
    const root = "/proc/" + current;
    const stat = read(root + "/stat");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    const startTicks = /^\d+$/.test(fields[19] ?? "") ? fields[19] : undefined;
    if (startTicks !== undefined) identities.set(current, startTicks);
    const expectedStartTicks = recorded?.get(current);
    const sameIncarnation = expectedStartTicks === undefined ? null : startTicks === expectedStartTicks;
    const descriptors: { fd: string; target?: string; targetTruncated?: boolean; error?: string }[] = [];
    let descriptorError: string | undefined;
    try {
      const names = fs.readdirSync(root + "/fd").sort();
      if (names.length > 64) truncated = true;
      for (const name of names.slice(0, 64)) {
        try {
          const target = fs.readlinkSync(root + "/fd/" + name);
          descriptors.push({ fd: name, target: target.slice(0, 256), targetTruncated: target.length > 256 });
        }
        catch (error) { descriptors.push({ fd: name, error: String(error) }); }
      }
    } catch (error) { descriptorError = String(error); }
    let childDiscoveryError: string | undefined;
    if (!recorded && startTicks !== undefined) {
      try {
        const tasks = fs.readdirSync(root + "/task").sort();
        if (tasks.length > 64) truncated = true;
        for (const task of tasks.slice(0, 64)) {
          const children = read(root + "/task/" + task + "/children");
          if (children.startsWith("unavailable:")) { childDiscoveryError = children; continue; }
          for (const token of children.split(/\s+/)) {
            const childPid = Number(token);
            if (!Number.isSafeInteger(childPid) || childPid <= 0 || visited.has(childPid) || queue.includes(childPid)) continue;
            if (queue.length < 64) queue.push(childPid);
            else truncated = true;
          }
        }
      } catch (error) { childDiscoveryError = String(error); }
    }
    const afterStat = read(root + "/stat");
    const afterFields = afterStat.slice(afterStat.lastIndexOf(")") + 2).split(" ");
    const record = {
      pid: current, startTicks, expectedStartTicks, sameIncarnation,
      identityStableDuringSample: startTicks !== undefined && afterFields[19] === startTicks,
      state: startTicks === undefined ? undefined : fields[0],
      ppid: startTicks === undefined ? undefined : fields[1],
      statError: startTicks === undefined ? stat.slice(0, 256) : undefined,
      descriptors, descriptorError, childDiscoveryError,
    };
    const serialized = JSON.stringify(record);
    if (retainedCharacters + serialized.length <= 60_000) {
      records.push(record);
      retainedCharacters += serialized.length;
    } else truncated = true;
  }
  return { identities, snapshot: JSON.stringify({
    records, truncated, processLimit: 64, taskLimitPerProcess: 64,
    descriptorLimitPerProcess: 64, descriptorTargetCharacterLimit: 256,
    snapshotCharacterLimit: 60_000,
    discovery: recorded ? "recorded-pids-only" : "rooted-all-task-children",
    descendantCompletenessCertified: false,
  }) };
}
