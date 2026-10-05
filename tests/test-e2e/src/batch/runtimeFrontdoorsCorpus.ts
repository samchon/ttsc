import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { BatchWorkspace } from "./BatchWorkspace";
import { runRuntimeSignalSessions } from "../features/ttsc/ttsx-runtime/test_ttsx_forwards_termination_signals_and_cleans_up_on_posix";

/**
 * Retain irreducible Node startup and terminal contracts on one staged graph.
 *
 * @evidence contracts/testing.md#behavioral-verification Real installed public register and CLI children preserve CommonJS main/native cache/prefix-only builtins/typed dependency, ESM SQLite, JavaScript main under import preload with exact tail argv, handled exception survival and actual exit7/throw1/rejection1 statuses.
 * @evidence contracts/testing.md#independent-expectations Authored dep+leaf, main/cache booleans, UUID36, SQLite-close completion, exact forwarded tokens and literal OS statuses are independent of product outputs. Original input bytes and actual synchronous child closure are checked.
 * @evidence contracts/testing.md#distinguishing-cases Import-register and import-preload plus require-register are distinct startup modes. Typed CommonJS and ESM entry ownership differ from JavaScript main requiring TypeScript; handled continuation contrasts with three terminal outcomes.
 * @evidence contracts/testing.md#execution-ownership One Runtime DAG body owns eight additional real launcher lifetimes: four direct Node/register startup modes, one handled-exception CLI and three terminal CLIs. The four CLI launchers also start their actual entry children, so these are at least twelve Node lifetimes, with further native preparation work still delegated and uncounted here. Fatal exits and preload selection require separate lifetimes; no child is created per source or builtin. No one-Program or zero-cost claim is made.
 * @evidence contracts/e2e.md#necessary-boundary Native Node preload/main dispatch, register hooks, SQLite module loading and terminal statuses cannot be established by argument classification or cached source units.
 * @evidence contracts/e2e.md#shared-execution All eight launcher requests and their actual entry children read one upfront immutable project and shared available cache. Compatible builtin/dependency assertions are combined in each startup; terminal and startup-mode lifetimes remain explicitly separate.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each synchronous spawn owns a real status/signal/PID receipt and joins closure before the next. Runtime ownership environment inherited from unrelated actors is removed. Source bytes remain unchanged; unresolved closure blocks later shared reuse. Independent case failures are collected.
 * @evidence contracts/e2e.md#preserved-coverage Restores baseline selected native main/fatal/register/import-preload/JavaScript/ESM builtin meanings with one upfront island instead of per-case fixtures. On POSIX the same owning signal helper adds three real detached launcher/entry sessions for handled SIGTERM, unhandled SIGTERM and exactly-once group SIGINT with all three empty runtime-index assertions; Windows supplies no POSIX coverage. Those six additional Node lifetimes and repeated native checks remain costs. Every require spelling, cold orphan cache coherence and an overall single-digit process budget remain uncertified.
 */
export async function runtimeFrontdoorsCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/runtime-frontdoors");
  const register = path.resolve(
    path.dirname(workspace.installedTtsx),
    "../register.js",
  );
  const preload = pathToFileURL(path.join(root, "preload.mjs")).href;
  const sources = [
    "main.cjs",
    "src/main.ts",
    "src/dep.ts",
    "src/leaf.ts",
    "src/esm.mts",
    "src/exit.ts",
    "src/throws.ts",
    "src/rejects.mts",
    "src/handled.ts",
  ].map((name) => path.join(root, name));
  const original = sources.map((file) => fs.readFileSync(file));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TTSC_CACHE_DIR: workspace.cache,
  };
  for (const name of [
    "TTSX_RUNTIME_MANIFEST",
    "TTSX_RUNTIME_CACHE_DIR",
    "TTSX_RUNTIME_RUN_DIR",
    "TTSX_RUNTIME_RUNS_DIR",
  ])
    delete env[name];
  const failures: unknown[] = [];
  const run = (args: string[]) => {
    const result = E2eProcessTrace.spawnSync(process.execPath, args, {
      cwd: root,
      env,
      encoding: "utf8",
      windowsHide: true,
    });
    if (!isOrdinarilyClosedReadonlyLauncher(result)) {
      BatchWorkspace.retain(
        "native runtime frontdoor closure remained unresolved",
      );
      throw new Error("native runtime frontdoor closure remained unresolved", {
        cause:
          result.error ??
          new Error(
            JSON.stringify({
              pid: result.pid,
              status: result.status,
              signal: result.signal,
            }),
          ),
      });
    }
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    try {
      process.kill(result.pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return result;
      BatchWorkspace.retain(
        "runtime frontdoor PID closure could not be observed",
      );
      throw error;
    }
    BatchWorkspace.retain(
      "runtime frontdoor PID remained live after synchronous return",
    );
    throw new Error(
      "runtime frontdoor PID remained live after synchronous return",
    );
  };
  const capture = (name: string, body: () => void): void => {
    try {
      body();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  const typed = {
    main: true,
    cache: "object",
    shared: true,
    dep: "dep+leaf",
    prefix: true,
    cryptoLength: 36,
  };
  for (const [name, args] of [
    [
      "import-register typed main",
      ["--import", pathToFileURL(register).href, "src/main.ts"],
    ],
    [
      "import-preload require-register typed main",
      ["--import", preload, "-r", register, "src/main.ts"],
    ],
  ] as const)
    capture(name, () => {
      const result = run([...args]);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), typed);
    });
  capture("JavaScript main under import preload", () => {
    const result = run([
      "--import",
      preload,
      "-r",
      register,
      "main.cjs",
      "--config",
      "x",
      "--help",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      main: true,
      value: "dep+leaf",
      argv: ["--config", "x", "--help"],
    });
  });
  capture("ESM register SQLite", () => {
    const result = run(["--require", register, "src/esm.mts"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      kind: "esm",
      sqlite: "esm-sqlite-ok",
    });
  });
  capture("handled uncaught exception", () => {
    const result = run([
      workspace.installedTtsx,
      "--no-plugins",
      "src/handled.ts",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), [
      "handled: boom",
      "still alive",
    ]);
  });
  for (const [name, status, message] of [
    ["exit.ts", 7, undefined],
    ["throws.ts", 1, /unhandled runtime frontdoor/],
    ["rejects.mts", 1, /rejected runtime frontdoor/],
  ] as const)
    capture(name, () => {
      const result = run([
        workspace.installedTtsx,
        "--no-plugins",
        "src/" + name,
      ]);
      assert.equal(result.status, status, result.stderr);
      if (message !== undefined) assert.match(result.stderr, message);
    });
  for (let index = 0; index < sources.length; index++)
    capture("immutable " + sources[index], () =>
      assert.deepEqual(fs.readFileSync(sources[index]!), original[index]),
    );
  if (process.platform !== "win32") {
    let pending = 0;
    try {
      await runRuntimeSignalSessions(path.join(root, "signals"), () => {
        pending++;
        return () => { pending--; };
      }, workspace.installedTtsx, { TTSC_CACHE_DIR: undefined, TTSC_BINARY: undefined, TTSC_TSGO_BINARY: undefined });
    } catch (error) { failures.push(new Error("native POSIX signal sessions", { cause: error })); }
    finally { if (pending !== 0) BatchWorkspace.retain("native signal session closure remained unresolved"); }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "native runtime startup and terminal corpus failed",
    );
}
