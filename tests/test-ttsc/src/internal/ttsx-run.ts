import { TestProject } from "@ttsc/testing";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** A ttsx run whose program is up and waiting. */
export interface IWaitingRun {
  /** The launcher process. */
  launcher: child_process.ChildProcess;
  /** The pid of the program the launcher spawned. */
  program: number;
  /** Everything the run printed so far. */
  output(): string;
}

/**
 * A program that prints `ready:<pid>` and then waits until it is terminated,
 * for `startWaitingRun`.
 */
export const WAITING_PROGRAM = [
  `declare const process: { pid: number };`,
  `declare function setInterval(callback: () => void, ms: number): unknown;`,
  `console.log("ready:" + process.pid);`,
  `setInterval(() => {}, 1000);`,
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
 * it printed its pid.
 */
export function startWaitingRun(
  root: string,
  entry: string,
): Promise<IWaitingRun> {
  return new Promise((resolve, reject) => {
    const launcher = child_process.spawn(
      process.execPath,
      [TestProject.TTSX_BIN, "--cwd", root, entry],
      {
        cwd: root,
        env: {
          ...process.env,
          TTSC_BINARY: TestProject.NATIVE_BINARY,
          TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let output = "";
    let started = false;
    const timer = setTimeout(() => {
      launcher.kill("SIGKILL");
      reject(new Error(`ttsx ${entry} did not start:\n${output}`));
    }, 120_000);
    const collect = (chunk: Buffer): void => {
      output += chunk.toString("utf8");
      const ready = /ready:(\d+)/.exec(output);
      if (started || ready === null) return;
      started = true;
      clearTimeout(timer);
      resolve({ launcher, output: () => output, program: Number(ready[1]) });
    };
    launcher.stdout!.on("data", collect);
    launcher.stderr!.on("data", collect);
    launcher.once("error", reject);
    launcher.once("exit", () => {
      if (started) return;
      clearTimeout(timer);
      reject(new Error(`ttsx ${entry} ended before it started:\n${output}`));
    });
  });
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
