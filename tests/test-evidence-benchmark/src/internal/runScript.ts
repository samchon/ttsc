import { type SpawnSyncReturns, spawnSync } from "node:child_process";

import type { IRunResult } from "./IRunResult";
import { scriptEnvironment } from "./scriptEnvironment";

/**
 * Generous because the FIRST lint of a cache key statically links this plugin's
 * Go into the lint binary, which ttsc itself warns "can take several minutes on
 * a cold Go cache". `tests/test-evidence` allows the same budget.
 */
const DEFAULT_TIMEOUT: number = 1_800_000;

/**
 * Runs one of the workspace's own package scripts and captures what it said.
 *
 * The scripts are the gate. A launched cell never invokes `prisma`, `nestia`,
 * or `ttsc` directly — it runs `pnpm build:prisma`, `pnpm build:sdk`, and `pnpm
 * lint` from a package directory, and the script bodies decide which project,
 * which output path, and which lint configuration each of those reaches.
 * Re-spelling a command here would test a command this repository does not
 * ship.
 *
 * The package manager is invoked through `process.env.npm_execpath` for the
 * same reason `EvidenceBenchmarkWorkspace` does: it is the entry point the
 * launching `pnpm` already resolved, so no shim on PATH has to be assumed.
 *
 * The environment is sanitized through the runner's own module for the same
 * reason. This suite runs under `ttsx`, which preloads its TypeScript hook into
 * every descendant through `NODE_OPTIONS`; a launched cell's scripts never see
 * it, because `EvidenceBenchmarkRunner` strips it before spawning the measured
 * agent. Leaving it here would run each gate in an environment no cell has —
 * and `vite build` fails outright in it, because loading `vite.config.ts` calls
 * a `resolveSync` the preloaded hook chain does not implement.
 */
export const runScript = (props: {
  readonly cwd: string;
  readonly script: string;
  readonly timeout?: number;
  readonly environment?: Readonly<Record<string, string>>;
}): IRunResult => {
  const entrypoint: string | undefined = process.env.npm_execpath;
  if (entrypoint === undefined)
    throw new Error(
      "The benchmark feature suite must be launched through pnpm; EvidenceBenchmarkWorkspace requires the same entry point.",
    );
  const started: number = Date.now();
  const result: SpawnSyncReturns<string> = spawnSync(
    process.execPath,
    [entrypoint, "run", props.script],
    {
      cwd: props.cwd,
      encoding: "utf8",
      env: scriptEnvironment(props.environment),
      timeout: props.timeout ?? DEFAULT_TIMEOUT,
      maxBuffer: 64 * 1024 * 1024,
      shell: false,
      windowsHide: true,
    },
  );
  const elapsedMs: number = Date.now() - started;
  const stdout: string = result.stdout ?? "";
  // A killed or unspawnable run reports its cause on `error` and nothing on
  // either stream, so without this an exhausted timeout — the likeliest way
  // these gates fail, because the first lint of a cache key links this
  // plugin's Go — would be reported as a null exit status with an empty
  // transcript and no stated reason.
  const stderr: string =
    result.error === undefined
      ? (result.stderr ?? "")
      : `${result.stderr ?? ""}\n${props.script} did not complete after ${String(elapsedMs)} ms: ${result.error.message}\n`;
  return {
    script: props.script,
    cwd: props.cwd,
    status: result.status,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
    elapsedMs,
  };
};
