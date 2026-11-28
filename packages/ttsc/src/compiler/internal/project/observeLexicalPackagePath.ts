import {
  MessageChannel,
  Worker,
  receiveMessageOnPort,
} from "node:worker_threads";

import { TrustedPreloadGraph } from "../../../internal/TrustedPreloadGraph";

/**
 * Observe Node's package selection before it canonicalizes symlinks. The caller
 * retains the current thread's selection, including any local hooks. This
 * helper contributes a lexical witness from Node's standard resolver.
 *
 * @evidence contracts/common.md#principled-implementation A Worker adds Node's preserve-symlinks option and runs the same createRequire resolution from the declaring config. Its lexical result can qualify a suspected lossy result but cannot substitute for the caller's selection.
 * @evidence contracts/common.md#clear-and-simple-design One lazy worker owns bounded synchronous queries and can serve both package manifests and direct config entries.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Only resolver conditions reach worker startup. Preloads, loaders, memory flags and NODE_OPTIONS are omitted, and failures supply no guessed path.
 * @evidence contracts/common.md#meaningful-documentation States the difference between the witness and the caller's resolver with local hooks.
 * @evidence contracts/portability.md#os-neutral-implementation Node worker and module APIs carry string paths. Windows does not need a witness for invalid POSIX names.
 * @evidence contracts/performance.md#efficient-algorithms The first POSIX package request starts one worker. Later queries use one bounded wait and one native resolution without relaunching the runtime or scanning directories in ttsc.
 * @evidence contracts/performance.md#reuse-equivalent-work A process shares the worker for successful transport. Node owns internal resolution reuse, which is not evidence about later files.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One unreferenced worker is retained per caller isolate and each port is closed after its request. A failed transport is retired and does not retry on subsequent lookups.
 */
export function observeLexicalPackagePath(
  from: string,
  specifier: string,
  conditions?: readonly string[],
): string | undefined {
  if (unavailable) return undefined;
  let active: Worker;
  try {
    active = worker ?? acquireWorker(conditions);
  } catch {
    unavailable = true;
    return undefined;
  }
  const { port1, port2 } = new MessageChannel();
  const state = new Int32Array(new SharedArrayBuffer(4));
  try {
    active.postMessage({ from, specifier, state, reply: port2 }, [port2]);
    if (Atomics.wait(state, 0, 0, 5_000) === "timed-out") {
      retireWorker(active);
      return undefined;
    }
    const result: unknown = receiveMessageOnPort(port1)?.message;
    return typeof result === "string" ? result : undefined;
  } catch {
    retireWorker(active);
    return undefined;
  } finally {
    port1.close();
    port2.close();
  }
}

let worker: Worker | undefined;
let unavailable = false;

function retireWorker(active: Worker): void {
  unavailable = true;
  if (worker === active) worker = undefined;
  void active.terminate();
}

/** Retain an idle worker without extending the owning process lifetime. */
function acquireWorker(conditions: readonly string[] | undefined): Worker {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  const created = new Worker(RESOLVE, {
    env,
    eval: true,
    execArgv: ["--preserve-symlinks", ...resolverOptions(conditions)],
  });
  const forget = () => {
    if (worker === created) {
      worker = undefined;
      unavailable = true;
    }
  };
  created.on("error", forget);
  created.once("exit", forget);
  created.unref();
  worker = created;
  return created;
}

/** Project the active native conditions, with argv fallback on older hooks. */
function resolverOptions(conditions: readonly string[] | undefined): string[] {
  if (conditions !== undefined) {
    const defaults = new Set(["node", "require", "node-addons", "module-sync"]);
    const result = conditions
      .filter((condition) => !defaults.has(condition))
      .map((condition) => `--conditions=${condition}`);
    if (!conditions.includes("node-addons")) result.push("--no-addons");
    if (!conditions.includes("module-sync"))
      result.push(
        process.allowedNodeEnvironmentFlags.has("--no-require-module")
          ? "--no-require-module"
          : "--no-experimental-require-module",
      );
    return result;
  }
  const result: string[] = [];
  for (const argv of [
    TrustedPreloadGraph.parse(process.env.NODE_OPTIONS ?? "") ?? [],
    process.execArgv,
  ]) {
    for (let index = 0; index < argv.length; index++) {
      const argument = argv[index]!;
      const equals = argument.indexOf("=");
      const name = (
        equals === -1 ? argument : argument.slice(0, equals)
      ).replaceAll("_", "-");
      if (name === "--conditions" || name === "-C") {
        const value =
          equals === -1 ? argv[++index] : argument.slice(equals + 1);
        if (value !== undefined) result.push(`--conditions=${value}`);
      } else if (equals === -1 && CONDITION_SWITCHES.has(name)) {
        result.push(name);
      }
    }
  }
  return result;
}

const CONDITION_SWITCHES = new Set([
  "--addons",
  "--no-addons",
  "--require-module",
  "--no-require-module",
  "--experimental-require-module",
  "--no-experimental-require-module",
]);

const RESOLVE = `
const { createRequire } = require("node:module");
const { parentPort } = require("node:worker_threads");
parentPort.on("message", ({ from, specifier, state, reply }) => {
  let selected;
  try { selected = createRequire(from).resolve(specifier); } catch {}
  try { reply.postMessage(selected); }
  finally {
    reply.close();
    Atomics.store(state, 0, 1);
    Atomics.notify(state, 0);
  }
});
`;
