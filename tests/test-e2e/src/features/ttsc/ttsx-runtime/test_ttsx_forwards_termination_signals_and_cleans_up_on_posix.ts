import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const child_process = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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
 * 1. Create a program that prints authenticated readiness and waits, with or without a
 *    `SIGTERM`/`SIGINT` handler that exits 3.
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
export async function test_ttsx_forwards_termination_signals_and_cleans_up_on_posix(): Promise<void | false> {
    if (process.platform === "win32") return false;
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "signals", private: true, workspaces: ["packages/*"] }),
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
 * @evidence contracts/common.md#principled-implementation Actual native signal sessions and original close receipts determine outcomes; no predicted termination or generated successful receipt replaces them.
 * @evidence contracts/common.md#clear-and-simple-design One existing session owner supplies signaling and close; this helper only sequences original modes and literal assertions on the supplied root.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Retains real process groups, token readiness, all signal modes and native directory checks. Unjoined failure cannot acknowledge assembler ownership.
 * @evidence contracts/common.md#meaningful-documentation States shared caller ownership, separate process lifetimes and the retained failure boundary without certifying execution.
 * @evidence contracts/portability.md#os-neutral-implementation The callers retain original POSIX admission; Windows is unselected rather than a simulated signal success.
 * @evidence contracts/performance.md#efficient-algorithms Exactly three fixed session invocations retain their original output and directory costs; no complete workspace scan is added.
 * @evidence contracts/performance.md#reuse-equivalent-work Supplied source graph and tools are reused; changed signal outcomes require separate actual lifetimes, and their compiler work is not inferred to vanish.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Existing timeout/error/close handling owns group cleanup and timers. Optional ownership acknowledgment follows the returned close receipt only; unresolved state retains inputs.
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
): Promise<void> {
  const run = async (entry: string, signal: Parameters<typeof runUntilSignaled>[2]) => {
    const acknowledgeJoined = ownAsyncProcess?.();
    const result = await runUntilSignaled(root, entry, signal);
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

    const handled = await run("src/handled.ts", (child) =>
      child.kill("SIGTERM"),
    );
    assert.equal(handled.code, 3, handled.output);
    assert.match(handled.output, /handled SIGTERM/);
    assert.deepEqual(listDirectory(runtimeRoot), []);

    const unhandled = await run(
      "src/unhandled.ts",
      (child) => child.kill("SIGTERM"),
    );
    assert.equal(unhandled.signal, "SIGTERM", unhandled.output);
    assert.deepEqual(listDirectory(runtimeRoot), []);

    const group = await run("src/handled.ts", (child) =>
      process.kill(-child.pid!, "SIGINT"),
    );
    assert.equal(group.code, 3, group.output);
    assert.match(group.output, /handled SIGINT/);
    assert.equal(
      group.output.match(/handled SIGINT/g)?.length,
      1,
      "SIGINT must reach the program once",
    );
    assert.deepEqual(listDirectory(runtimeRoot), []);

}


/**
 * Original signal program bytes shared by both owning entries.
 *
 * @evidence contracts/common.md#principled-implementation Authored TypeScript installs the optional native handlers before publishing the actual child-local ready token; each handler preserves original code3.
 * @evidence contracts/common.md#clear-and-simple-design One boolean selects original handler statements while common readiness and waiting bytes remain shared.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The value is program input, not a fabricated process outcome; real launcher execution owns the assertions.
 * @evidence contracts/common.md#meaningful-documentation Identifies literal input ownership without claiming that the generated program ran.
 * @evidence contracts/portability.md#os-neutral-implementation Original POSIX signal literals are used only by callers preserving POSIX admission.
 * @evidence contracts/performance.md#efficient-algorithms Joins a fixed original statement population into a string with work linear in those bytes.
 * @evidence contracts/performance.md#reuse-equivalent-work Standalone and consolidated entries consume the same literal source producer; handled versus unhandled inputs stay distinct.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Returns only an immutable input string; execution timers and processes belong to the session owner.
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
 * Start ttsx in its own process group, signal it once the program prints
 * the complete token-bearing stdout line, and collect how it ended.
 */
function runUntilSignaled(
  root: string,
  entry: string,
  signal: (child: child_process.ChildProcess) => void,
): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
  output: string;
}> {
  return new Promise((resolve, reject) => {
    const token = crypto.randomBytes(16).toString("hex");
    const child = child_process.spawn(
      process.execPath,
      [TestProject.TTSX_BIN, "--cwd", root, entry],
      {
        cwd: root,
        detached: true,
        env: {
          ...process.env,
          TTSC_BINARY: TestProject.NATIVE_BINARY,
          TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
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
        failure = new AggregateError([error, cleanupError], "signal session cleanup failed");
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
        if (signaled || failure !== undefined || line !== `ready:${token}`) continue;
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
        failure = failure === undefined
          ? error instanceof Error ? error : new Error(String(error))
          : new AggregateError([failure, error], "signal session cleanup failed");
      }
      if (failure !== undefined) reject(failure);
      else resolve({ code, signal: received, output });
    });
  });
}

function listDirectory(directory: string): string[] {
  return fs.existsSync(directory) ? fs.readdirSync(directory) : [];
}
