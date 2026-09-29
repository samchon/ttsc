import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import type { IRunResult } from "./IRunResult";
import { scriptEnvironment } from "./scriptEnvironment";

/**
 * Runs an existing workspace gate once and retains its compiler between stages.
 *
 * Pnpm forwards watch flags to the unchanged package script. Completed cycles
 * keep their actual success/failure markers and complete diagnostic text; a
 * stage may select its own cycle after another Program's earlier input edit.
 * The session owns and closes its process tree before the workspace is reused.
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
    if (child.pid === undefined || closed) return;
    const stop = async (force: boolean): Promise<void> => {
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
  return { nextBuild, close };
};
