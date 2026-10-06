import { TestProject } from "@ttsc/testing";
import nodeChildProcessForTrace, {
  type ChildProcess,
} from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { isolatedCacheEnvironment } from "./isolated-cache-environment";

const child_process = { ...nodeChildProcessForTrace, ...E2eProcessTrace };

/** A ttsx run whose program is up and waiting. */
export interface IWaitingRun {
  /** The launcher process. */
  launcher: ChildProcess;
  /** Resolves after the owned launcher and its captured stdio have closed. */
  closed: Promise<void>;
  /** Request completion through this fixture program's private nonce channel. */
  release(): void;
  /** The pid of the program the launcher spawned. */
  program: number;
  /** Everything the run printed so far. */
  output(): string;
}

/**
 * A program that prints `ready:<token>:<pid>` and waits until terminated, for
 * `startWaitingRun`.
 */
export const WAITING_PROGRAM = [
  `declare const process: { pid: number; env: Record<string, string | undefined>; exit(code: number): never };`,
  `declare function setInterval(callback: () => void, ms: number): unknown;`,
  `console.log("ready:" + process.env.TTSC_TEST_READY_TOKEN + ":" + process.pid);`,
  `declare function require(name: string): { readFileSync(file: string, encoding: string): string };`,
  `const control = process.env.TTSC_TEST_WAITING_CONTROL;`,
  `if (!control) throw new Error("missing waiting control path");`,
  `setInterval(() => { if (require("node:fs").readFileSync(control, "utf8") === process.env.TTSC_TEST_READY_TOKEN) process.exit(0); }, 25);`,
  `export {};`,
  ``,
].join("\n");

/** The directory holding one directory per run under a project's default cache. */
export function runtimeRunsDirectory(root: string): string {
  return path.join(root, "node_modules", ".cache", "ttsc", "ttsx", "project");
}

/**
 * The directory of the run whose launcher is `pid` under `runs`. A run names
 * its directory by its pid followed by a nonce, so it is found by that prefix;
 * the path of an absent directory names the pid alone.
 */
export function runDirectory(runs: string, pid: number): string {
  let names: string[];
  try {
    names = fs.readdirSync(runs);
  } catch {
    names = [];
  }
  const name = names.find((entry) => entry.startsWith(`${pid}-`));
  return path.join(runs, name ?? String(pid));
}

/**
 * Start ttsx on `entry`, a program such as `WAITING_PROGRAM`, and resolve once
 * its complete stdout line carries this spawn's random token and a valid PID.
 * Stderr remains diagnostic output. Failed startup closes the owned POSIX group
 * or Windows taskkill tree before rejecting.
 */
export function startWaitingRun(
  root: string,
  entry: string,
): Promise<IWaitingRun> {
  return new Promise((resolve, reject) => {
    const token = crypto.randomBytes(16).toString("hex");
    const control = path.join(root, `waiting-${token}.control`);
    fs.writeFileSync(control, "", "utf8");
    const launcher = child_process.spawn(
      process.execPath,
      [TestProject.TTSX_BIN, "--cwd", root, entry],
      {
        cwd: root,
        detached: process.platform !== "win32",
        env: {
          ...process.env,
          ...isolatedCacheEnvironment(root),
          TTSC_BINARY: TestProject.NATIVE_BINARY,
          TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
          TTSC_TEST_READY_TOKEN: token,
          TTSC_TEST_WAITING_CONTROL: control,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    const closed = new Promise<void>((done) =>
      launcher.once("close", () => done()),
    );
    let output = "";
    let stdout = "";
    let settled = false;
    let program: number | undefined;
    const fail = async (error: Error): Promise<void> => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        await stopWaitingProcessTree(launcher, program);
        await closed;
        reject(error);
      } catch (cleanupError) {
        reject(
          new AggregateError(
            [error, cleanupError],
            "waiting run failed and cleanup failed",
          ),
        );
      }
    };
    const timer = setTimeout(() => {
      void fail(new Error(`ttsx ${entry} did not start:\n${output}`));
    }, 120_000);
    launcher.stdout!.on("data", (chunk: Buffer) => {
      const bytes = chunk.toString("utf8");
      output += bytes;
      stdout += bytes;
      for (;;) {
        const newline = stdout.indexOf("\n");
        if (newline < 0) break;
        const line = stdout.slice(0, newline).replace(/\r$/, "");
        stdout = stdout.slice(newline + 1);
        const prefix = `ready:${token}:`;
        if (!line.startsWith(prefix)) continue;
        const pidText = line.slice(prefix.length);
        const pid = /^\d+$/.test(pidText) ? Number(pidText) : NaN;
        if (!Number.isSafeInteger(pid) || pid <= 0 || pid === launcher.pid) {
          void fail(new Error(`invalid waiting program PID: ${line}`));
          continue;
        }
        if (settled) continue;
        program = pid;
        settled = true;
        clearTimeout(timer);
        resolve({
          launcher,
          closed,
          release: () => fs.writeFileSync(control, token, "utf8"),
          output: () => output,
          program,
        });
      }
    });
    launcher.stderr!.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    launcher.once("error", (error) => void fail(error));
    launcher.once("close", () => {
      if (!settled)
        void fail(
          new Error(`ttsx ${entry} ended before it started:\n${output}`),
        );
    });
  });
}

/**
 * End the test-owned launcher tree and authenticated waiting program.
 * Intentional launcher-only termination remains a separate test operation; this
 * helper closes the authenticated program through its nonce channel even after
 * the launcher exited. It never kills a formerly observed program PID, which
 * may already have been recycled after an intentional force kill.
 */
export async function stopWaitingRun(run: IWaitingRun): Promise<void> {
  run.release();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      run.closed,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "waiting program did not close after its authenticated release",
              ),
            ),
          60_000,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Startup may fail before a program PID exists; its owned tree still closes. */
async function stopWaitingProcessTree(
  launcher: ChildProcess,
  program: number | undefined,
): Promise<void> {
  const failures: unknown[] = [];
  if (launcher.pid !== undefined) {
    if (process.platform !== "win32") {
      try {
        process.kill(-launcher.pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH")
          failures.push(error);
      }
    } else if (launcher.exitCode === null && launcher.signalCode === null) {
      const result = child_process.spawnSync(
        "taskkill",
        ["/PID", String(launcher.pid), "/T", "/F"],
        { windowsHide: true, encoding: "utf8" },
      );
      if (
        result.error !== undefined ||
        (result.status !== 0 && isRunning(launcher.pid))
      ) {
        failures.push(
          result.error ?? new Error(result.stderr || result.stdout),
        );
      }
    }
  }
  const pids = [
    launcher.exitCode === null && launcher.signalCode === null
      ? launcher.pid
      : undefined,
    program,
  ].filter((pid): pid is number => pid !== undefined);
  const results = await Promise.allSettled(
    pids.map((pid) => forceTerminate(pid)),
  );
  for (const result of results)
    if (result.status === "rejected") failures.push(result.reason);
  if (failures.length !== 0)
    throw new AggregateError(failures, "waiting run cleanup failed");
}

/** Whether a process with `pid` is running. */
export function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Terminate the process `pid` outright, the way a supervisor's kill or a closed
 * terminal ends it, with no chance to run its own cleanup, and resolve once it
 * is gone.
 */
export async function forceTerminate(pid: number): Promise<void> {
  if (isRunning(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Ended between the check and the kill.
    }
  }
  const deadline = Date.now() + 60_000;
  while (isRunning(pid)) {
    if (Date.now() > deadline) throw new Error(`process ${pid} did not end`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
