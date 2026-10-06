import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace, {
  type ChildProcess,
} from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";

const child_process = { ...nodeChildProcessForTrace, ...E2eProcessTrace };

/**
 * Verifies ttsx forwards termination signals to the program, reports how it
 * ended the way `node` would, and removes its runtime directory on every such
 * exit. POSIX only: Windows has no signal delivery of this kind.
 *
 * Pins samchon/ttsc#1403. ttsx ran the program with a blocking spawn, so a
 * `SIGTERM` sent to the launcher alone (a supervisor, a container stop) killed
 * the launcher before its cleanup ran, never reached the program, and left the
 * runtime directory behind; a program that died of a signal made ttsx exit 1
 * instead of dying of the same signal.
 *
 * 1. Create a program that prints authenticated readiness and waits, with or
 *    without a `SIGTERM`/`SIGINT` handler that exits 3.
 * 2. Send `SIGTERM` to the launcher's pid alone, and `SIGINT` to its process
 *    group, once the program is ready.
 * 3. Assert the handler ran and its code came back, an unhandled `SIGTERM` ended
 *    ttsx by `SIGTERM`, and no runtime directory remains.
 *
 * @evidence contracts/testing.md#behavioral-verification Real SIGTERM to the launcher must reach a handler and return exit 3; unhandled SIGTERM must report that signal; process-group SIGINT must reach the handler once. Each session must remove runtime output.
 * @evidence contracts/testing.md#independent-expectations Native close code/signal, literal handler output and exactly one SIGINT occurrence are independent Node process observations, while native directory reads check cleanup.
 * @evidence contracts/testing.md#distinguishing-cases Handled and unhandled SIGTERM distinguish forwarding from signal propagation; group SIGINT distinguishes duplicate launcher forwarding from direct group delivery. Windows returns because this delivery model is unavailable.
 * Unavailable host capabilities return false so the runner reports SKIPPED without claiming this case executed its behavioral assertions.
 *
 * @evidence contracts/testing.md#execution-ownership The named async E2E entry owns three POSIX detached launcher/program sessions and their assertions; program and signaling helpers are not separate test entries.
 * @evidence contracts/e2e.md#necessary-boundary Real process-group delivery and native termination reporting require actual launcher/program lifetimes; a signal-listener unit cannot establish kernel delivery or resulting cleanup.
 * @evidence contracts/e2e.md#shared-execution The three sessions share one project and existing compiler artifacts, but distinct termination modes require separate lifetimes; current preparation still repeats checked compilation for those sessions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture declares its own workspace boundary so an ancestor installation cannot select an external cache. Each launcher owns a distinct POSIX process group; only its authenticated complete stdout readiness line gates signaling. Close, error and timeout clear the timer and terminate that owned group before settlement; stderr supplies diagnostics only.
 * @evidence contracts/e2e.md#preserved-coverage Handled codes/output, unhandled native signal, exactly-once group delivery and all three empty runtime-index assertions remain; the Windows capability condition is unchanged and returns false without claiming POSIX coverage.
 */
export async function test_ttsx_forwards_termination_signals_and_cleans_up_on_posix(): Promise<
  void | false
> {
  if (process.platform === "win32") return false;
  const root = TestProject.createProject({
    "package.json": JSON.stringify({
      name: "signals",
      private: true,
      workspaces: ["packages/*"],
    }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "lib",
        types: [],
      },
      include: ["src"],
    }),
    "src/handled.ts": runtimeSignalProgram(true),
    "src/unhandled.ts": runtimeSignalProgram(false),
  });
  await runRuntimeSignalSessions(root);
}

/**
 * Executes the original three POSIX signal lifetimes on an already staged
 * project. The standalone and consolidated entries share these real sessions.
 *
 * @evidence contracts/testing.md#behavioral-verification Handled launcher SIGTERM returns 3 and its literal output; unhandled SIGTERM reports SIGTERM; group SIGINT returns 3 with exactly one handler receipt. All three native runtime indices are empty after their closes.
 * @evidence contracts/testing.md#independent-expectations Literal handler strings, code3, native SIGTERM and empty directory reads are independent of forwarding implementation. Authenticated stdout readiness determines when the real kernel signal is delivered.
 * @evidence contracts/testing.md#distinguishing-cases Launcher-only handled/unhandled SIGTERM and group SIGINT retain three independent termination modes; no session is replaced by an expected process count.
 * @evidence contracts/testing.md#execution-ownership Both named Runtime entries call this owning helper; it creates no project or separate discovered test population. The caller preserves POSIX-only admission.
 * @evidence contracts/e2e.md#necessary-boundary Native process-group delivery and actual launcher-program termination cannot be certified by signal-listener units.
 * @evidence contracts/e2e.md#shared-execution One caller-supplied authored root and shipped tools support three necessary launcher/program lifetimes; compilation and process costs remain actual measured work, not inferred reuse.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Existing authenticated readiness, timeout, group cleanup and ChildProcess close remain the original authority. Optional assembler ownership begins before each real session and is acknowledged only after its returned close receipt; a rejected session leaves ownership pending and retains the graph.
 * @evidence contracts/e2e.md#preserved-coverage All original code, signal, exact occurrence and three empty-index assertions execute unchanged. Standalone donor remains selected until actual survivor proof.
 */
export async function runRuntimeSignalSessions(
  root: string,
  ownAsyncProcess?: () => () => void,
  launcher: string = TestProject.TTSX_BIN,
  environment?: NodeJS.ProcessEnv,
): Promise<void> {
  const run = async (
    entry: string,
    signal: Parameters<typeof runUntilSignaled>[2],
  ) => {
    const acknowledgeJoined = ownAsyncProcess?.();
    const result = await runUntilSignaled(
      root,
      entry,
      signal,
      launcher,
      environment,
    );
    acknowledgeJoined?.();
    return result;
  };
  const runtimeRoot = path.join(
    root,
    "node_modules",
    ".cache",
    "ttsc",
    "ttsx",
    "project",
  );

  const failures: unknown[] = [];
  let sessionUnconfirmed = false;
  const collect = async (
    name: string,
    entry: string,
    signal: Parameters<typeof runUntilSignaled>[2],
    verify: (result: Awaited<ReturnType<typeof runUntilSignaled>>) => void,
  ): Promise<void> => {
    if (sessionUnconfirmed) return;
    let joined = false;
    try {
      const result = await run(entry, signal);
      joined = true;
      verify(result);
      assert.deepEqual(listDirectory(runtimeRoot), []);
    } catch (error) {
      sessionUnconfirmed = !joined;
      failures.push(new Error(name, { cause: error }));
    }
  };
  await collect(
    "handled SIGTERM",
    "src/handled.ts",
    (child) => child.kill("SIGTERM"),
    (handled) => {
      assert.equal(handled.code, 3, handled.output);
      assert.match(handled.output, /handled SIGTERM/);
    },
  );
  await collect(
    "unhandled SIGTERM",
    "src/unhandled.ts",
    (child) => child.kill("SIGTERM"),
    (unhandled) => {
      assert.equal(unhandled.signal, "SIGTERM", unhandled.output);
    },
  );
  await collect(
    "group SIGINT",
    "src/handled.ts",
    (child) => process.kill(-child.pid!, "SIGINT"),
    (group) => {
      assert.equal(group.code, 3, group.output);
      assert.match(group.output, /handled SIGINT/);
      assert.equal(
        group.output.match(/handled SIGINT/g)?.length,
        1,
        "SIGINT must reach the program once",
      );
    },
  );
  if (failures.length)
    throw new AggregateError(failures, "native signal session failures");
}

/**
 * Original signal program bytes shared by both owning entries.
 *
 * @evidence contracts/testing.md#behavioral-verification Deliberate executable input is consumed by runRuntimeSignalSessions, which asserts native handled exit3, unhandled SIGTERM and exactly one group SIGINT handler output. No assertion merely checks this string's arrangement.
 * @evidence contracts/testing.md#independent-expectations Authored handlers print the received signal and exit3; independent native close code/signal and empty runtime indices supply the observed result outside this producer.
 * @evidence contracts/testing.md#distinguishing-cases The boolean supplies handled SIGTERM/SIGINT versus a program without handlers. Both publish authenticated readiness and stay live until the real signal.
 * @evidence contracts/testing.md#execution-ownership The named POSIX test and legacy canonical Runtime caller execute these fixture bytes through runRuntimeSignalSessions. This helper is not another discovered experiment.
 * @evidence contracts/e2e.md#necessary-boundary Actual ttsx executes this input; constructing its bytes alone proves neither kernel signal delivery nor cleanup.
 * @evidence contracts/e2e.md#shared-execution Both modes reuse supplied project tools; their three distinct termination lifetimes and repeated checked compilation remain explicit unfinished consolidation costs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each real session receives a fresh ready token. The session owner joins close and cleans its group; this immutable input owns no process or timer.
 * @evidence contracts/e2e.md#preserved-coverage Original handled/unhandled programs, code3, exact output occurrence, native SIGTERM and three directory cleanup assertions remain in runRuntimeSignalSessions; authored input replaces no actual result.
 */
export function runtimeSignalProgram(handles: boolean): string {
  return [
    `declare const process: { env: Record<string, string | undefined>; on(event: string, listener: (signal: string) => void): void; exit(code: number): never };`,
    `declare function setInterval(callback: () => void, ms: number): unknown;`,
    ...(handles
      ? [
          `for (const signal of ["SIGTERM", "SIGINT"]) {`,
          `  process.on(signal, (received) => {`,
          `    console.log("handled " + received);`,
          `    process.exit(3);`,
          `  });`,
          `}`,
        ]
      : []),
    `console.log("ready:" + process.env.TTSC_TEST_READY_TOKEN);`,
    `setInterval(() => {}, 1000);`,
    `export {};`,
    ``,
  ].join("\n");
}

/**
 * Start ttsx in its own process group, signal it once the program prints the
 * complete token-bearing stdout line, and collect how it ended.
 */
function runUntilSignaled(
  root: string,
  entry: string,
  signal: (child: ChildProcess) => void,
  launcher: string,
  environment?: NodeJS.ProcessEnv,
): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
  output: string;
}> {
  return new Promise((resolve, reject) => {
    const token = crypto.randomBytes(16).toString("hex");
    const child = child_process.spawn(
      process.execPath,
      [launcher, "--cwd", root, entry],
      {
        cwd: root,
        detached: true,
        env: {
          ...process.env,
          TTSC_BINARY: TestProject.NATIVE_BINARY,
          TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
          ...environment,
          TTSC_TEST_READY_TOKEN: token,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    let stdout = "";
    let signaled = false;
    let failure: Error | undefined;
    const closeGroup = (): void => {
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    };
    const fail = (error: Error): void => {
      if (failure !== undefined) return;
      failure = error;
      clearTimeout(timer);
      try {
        closeGroup();
      } catch (cleanupError) {
        failure = new AggregateError(
          [error, cleanupError],
          "signal session cleanup failed",
        );
        child.kill("SIGKILL");
      }
    };
    const timer = setTimeout(() => {
      fail(new Error(`ttsx ${entry} did not end:\n${output}`));
    }, 120_000);
    child.stdout!.on("data", (chunk: Buffer) => {
      const bytes = chunk.toString("utf8");
      output += bytes;
      stdout += bytes;
      for (;;) {
        const newline = stdout.indexOf("\n");
        if (newline < 0) break;
        const line = stdout.slice(0, newline).replace(/\r$/, "");
        stdout = stdout.slice(newline + 1);
        if (signaled || failure !== undefined || line !== `ready:${token}`)
          continue;
        signaled = true;
        try {
          signal(child);
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
    child.stderr!.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.once("error", fail);
    child.once("close", (code, received) => {
      clearTimeout(timer);
      try {
        closeGroup();
      } catch (error) {
        failure =
          failure === undefined
            ? error instanceof Error
              ? error
              : new Error(String(error))
            : new AggregateError(
                [failure, error],
                "signal session cleanup failed",
              );
      }
      if (failure !== undefined) reject(failure);
      else resolve({ code, signal: received, output });
    });
  });
}

function listDirectory(directory: string): string[] {
  return fs.existsSync(directory) ? fs.readdirSync(directory) : [];
}
