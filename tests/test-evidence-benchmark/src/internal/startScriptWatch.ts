import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import type { IRunResult } from "./IRunResult";
import { scriptEnvironment } from "./scriptEnvironment";

/** Closers retained until each process and its inherited streams have joined. */
const watches = new Set<() => Promise<void>>();

/**
 * Runs an existing workspace gate once and retains its compiler between stages.
 *
 * Pnpm forwards watch flags to the unchanged package script. Completed cycles
 * keep their actual success/failure markers and complete diagnostic text; a
 * stage may select its own cycle after another Program's earlier input edit.
 * The session owns and closes its process tree before the workspace is reused.
 *
 * @evidence contracts/common.md#principled-implementation Retains the actual pnpm child and complete streams, recognizes compiler cycle markers and requires native close before claiming the watch was released.
 * @evidence contracts/common.md#clear-and-simple-design Owns launch, cycle cursor and close as one session; the suite registry retains its closer until the child's close event.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not fabricate compilation status or address an already-exited Windows PID. A process whose streams remain open after bounded termination attempts fails closure.
 * @evidence contracts/common.md#meaningful-documentation Describes actual script execution, retained compiler cycles and the close-before-reuse ownership boundary.
 * @evidence contracts/performance.md#efficient-algorithms Scans newly completed watch output through a retained cursor; retained diagnostic bytes grow with this finite session's cycles and are released with the session.
 * @evidence contracts/performance.md#reuse-equivalent-work Consecutive mutation stages reuse the real compiler process; an acceptance callback selects the matching completed cycle rather than treating an earlier quiet state as current.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Every spawned watch joins the suite closer registry until native close; close waits ten seconds then a five-second forced boundary and reports still-open streams. The registry permits final recovery when a case's own finally fails.
 * @evidence contracts/portability.md#os-neutral-implementation Uses argv-based pnpm spawning, Windows taskkill of the still-live owned process tree and POSIX signals to its detached process group; neither targets unrelated global processes.
 */
export const startScriptWatch = (props: {
  readonly cwd: string;
  readonly script: string;
}) => {
  const entrypoint = process.env.npm_execpath;
  if (entrypoint === undefined)
    throw new Error(
      "The benchmark feature suite must be launched through pnpm.",
    );
  const child = spawn(
    process.execPath,
    [entrypoint, "run", props.script, "--watch", "--preserveWatchOutput"],
    {
      cwd: props.cwd,
      env: scriptEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
    },
  );
  let text = "";
  let cursor = 0;
  let exited = false;
  let closed = false;
  let processError: Error | undefined;
  child.stdout.on("data", (chunk: Buffer) => {
    text += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    text += chunk.toString();
  });
  child.on("error", (error) => {
    processError = error;
  });
  child.on("exit", () => {
    exited = true;
  });
  child.on("close", () => {
    closed = true;
    watches.delete(close);
  });
  const marker = /\[ttsc\] watch build (complete|failed)\r?\n/g;

  const nextBuild = async (
    accepts: (result: IRunResult) => boolean = () => true,
    timeout = 120_000,
  ): Promise<IRunResult> => {
    const started = Date.now();
    for (;;) {
      marker.lastIndex = cursor;
      const match = marker.exec(text);
      if (match !== null) {
        const end = match.index + match[0].length;
        const output = text.slice(cursor, end);
        cursor = end;
        const result: IRunResult = {
          ...props,
          status: match[1] === "complete" ? 0 : 2,
          stdout: output,
          stderr: "",
          output,
          elapsedMs: Date.now() - started,
        };
        if (accepts(result)) return result;
        continue;
      }
      if (processError !== undefined) throw processError;
      if (exited || Date.now() - started >= timeout)
        throw new Error(
          `pnpm ${props.script} watch did not finish the expected cycle.\n${text}`,
        );
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
  };

  const close = async (): Promise<void> => {
    if (closed) return;
    const stop = async (force: boolean): Promise<void> => {
      if (child.pid === undefined) return;
      if (process.platform === "win32") {
        // An exited PID can already belong to another process. Never address
        // it again; inherited pipes must close or cleanup reports a failure.
        if (exited) return;
        await promisify(execFile)(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true },
        ).catch(() => undefined);
      } else {
        try {
          process.kill(-child.pid!, force ? "SIGKILL" : "SIGTERM");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
      }
    };
    await stop(false);
    const deadline = Date.now() + 10_000;
    while (!closed && Date.now() < deadline)
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    if (!closed) {
      await stop(true);
      const forcedDeadline = Date.now() + 5_000;
      while (!closed && Date.now() < forcedDeadline)
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
    if (!closed)
      throw new Error(
        `pnpm ${props.script} watch did not close its process streams.`,
      );
  };
  watches.add(close);
  return { nextBuild, close };
};

/**
 * Joins every outstanding suite watch; independent close failures are collected.
 *
 * @evidence contracts/common.md#principled-implementation Awaits every registered actual child closer before returning; any rejected join prevents the runner from deleting live children's workspaces.
 * @evidence contracts/common.md#clear-and-simple-design One suite-level operation recovers remaining session closers and reports an aggregate rather than duplicating termination behavior.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not hide an early failure, stop visiting later sessions or substitute a delay for native close observation.
 * @evidence contracts/common.md#meaningful-documentation States that independent close failures are collected and that workspace release requires this operation to succeed.
 * @evidence contracts/performance.md#efficient-algorithms Visits each retained closer once and joins independent sessions concurrently; no polling scan of operating-system processes is needed.
 * @evidence contracts/performance.md#reuse-equivalent-work Reuses each session's existing close operation and native lifecycle state rather than launching another host or manufacturing shutdown completion.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The close event removes registry entries, including naturally finished children; failed entries remain explicit with retained resource inputs until successful closure or process termination.
 * @evidence contracts/portability.md#os-neutral-implementation Uses the same native session closers on both platforms, preserving their Windows PID and POSIX process-group ownership distinctions.
 */
export const closeBenchmarkWatches = async (): Promise<void> => {
  const results = await Promise.allSettled([...watches].map((close) => close()));
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason as unknown] : []);
  if (failures.length !== 0)
    throw new AggregateError(failures, "Benchmark watch children did not all close.");
};
