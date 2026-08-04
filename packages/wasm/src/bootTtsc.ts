// Boots a host-built wasm and returns the JS-side handle.
//
// Order of operations matters: wasm_exec.js installs default no-op fs/process
// shims if `globalThis.fs` is missing at load time, so we must install our
// MemFS BEFORE importing wasm_exec.js.
//
// The boot helper is parameterized by `apiName` so any wasm built with
// `host.Expose(...)` can be loaded the same way. The base wasm uses "ttsc";
// downstream consumers pick their own (e.g. "ttscPlayground", "ttscTypia").
import { BootTtscWorkerTerminationError } from "./BootTtscWorkerTerminationError";
import { createMemFS } from "./createMemFS";
import type { IBootResult } from "./structures/IBootResult";
import type { IBootTtscOptions } from "./structures/IBootTtscOptions";
import type { ITtscApi } from "./structures/ITtscApi";

declare const importScripts: (...urls: string[]) => void;

/**
 * Per-(apiName, wasmUrl) single-flight cache for boots. Keying on apiName alone
 * would let a second call with the same apiName but a different wasmUrl
 * silently return the cached IBootResult of the first wasm — the caller would
 * think they booted a fresh binary while the cached one stayed in place. The
 * composite key lets HMR / cache-busting query strings get a fresh boot while
 * still single-flighting genuine concurrent duplicate calls.
 */
interface BootInFlight {
  controller: AbortController;
  promise: Promise<IBootResult>;
}

interface BootCancellationReason {
  kind: "abort";
  reason?: unknown;
}

const bootsInFlight = new Map<string, BootInFlight>();

/**
 * Terminal failures keyed by the global API bridge they own. A failed runtime
 * cannot be stopped after `go.run` starts, so no later boot may install another
 * readiness bridge for that API name inside the same Worker.
 */
const terminalBootFailuresByApiName = new Map<
  string,
  BootTtscWorkerTerminationError
>();

/**
 * Per-apiName serialization chain. Two concurrent boots with the same apiName
 * but different wasmUrls each install their own `globalThis[apiName
 *
 * - "Ready"]`resolver — they would race and the second would overwrite the first,
 *   stranding the first boot's await. The chain serializes them so one boot's
 *   Go-side`Ready.Invoke()` always lands on the resolver that boot installed.
 */
const bootChainByApiName = new Map<string, Promise<unknown>>();

function bootKey(apiName: string, wasmUrl: string): string {
  return `${apiName}|${resolveWasmUrl(wasmUrl)}`;
}

/**
 * Resolve `wasmUrl` against the current document base before keying so that
 * `./playground.wasm`, `/compiler/playground.wasm`, and the fully qualified
 * absolute href all collapse to the same cache entry instead of spawning
 * duplicate boots. Falls back to the raw string when no base is available
 * (Node-side tests, non-DOM workers).
 */
function resolveWasmUrl(wasmUrl: string): string {
  try {
    const base =
      typeof location !== "undefined" ? location.href : "http://local/";
    return new URL(wasmUrl, base).href;
  } catch {
    return wasmUrl;
  }
}

/**
 * Boot a host-built wasm. Re-entrant only if you reuse the same `host`.
 *
 * Concurrent calls with the same `(apiName, wasmUrl)` pair share the same
 * in-flight boot. Calls with the same `apiName` but different `wasmUrl` are
 * serialized via `bootChainByApiName` so they don't race on the shared
 * `globalThis[apiName+"Ready"]` resolver slot. A rejection before `go.run`
 * clears the cache entries so the next call can retry from scratch. A rejection
 * after `go.run` terminally poisons that API name because JavaScript cannot
 * stop the old runtime; replace the Worker before retrying.
 *
 * **Single-Worker caveat.** Even with the chain, a second boot loaded into the
 * SAME Worker after a first boot completes will overlay its Go runtime on top
 * of the first — `importScripts(wasmExecUrl)` rebinds `globalThis.Go`, and the
 * first wasm's keepalive goroutine keeps running through the new runtime's
 * js-bridge tables. The serialization is sufficient for the typical use case
 * (one boot per Worker over the page's lifetime) but DOES NOT make a Worker
 * safe to host two wasm instances at once. Create a fresh Worker per concurrent
 * wasm.
 */
export function bootTtsc(options: IBootTtscOptions): Promise<IBootResult> {
  const apiName = options.apiName ?? "ttsc";
  const key = bootKey(apiName, options.wasmUrl);
  const terminalFailure = terminalBootFailuresByApiName.get(apiName);
  if (terminalFailure) return Promise.reject(terminalFailure);
  const inflight = bootsInFlight.get(key);
  if (inflight) {
    attachBootCancellation(inflight, options.signal);
    return inflight.promise;
  }
  const controller = new AbortController();
  const prior = bootChainByApiName.get(apiName) ?? Promise.resolve();
  const queuedCancellation = createBootCancellationPromise(
    controller.signal,
    apiName,
    () => "waiting for an earlier boot",
  );
  const queued = prior
    .catch(() => {
      /* don't propagate a prior boot's rejection — let this one run */
    })
    .then(() => {
      throwIfBootWorkerTerminated(apiName);
      throwIfBootCanceled(
        controller.signal,
        apiName,
        "waiting for an earlier boot",
      );
      queuedCancellation.dispose();
      return bootTtscOnce(options, apiName, controller.signal);
    });
  let entry!: BootInFlight;
  const promise = Promise.race([queued, queuedCancellation.promise])
    .catch((err) => {
      if (bootsInFlight.get(key) === entry) bootsInFlight.delete(key);
      throw err;
    })
    .finally(queuedCancellation.dispose);
  entry = { controller, promise };
  bootsInFlight.set(key, entry);
  attachBootCancellation(entry, options.signal);
  // Track the chain head for this apiName so the next boot waits on it.
  // Swallow on the chain head specifically: we already throw to the
  // immediate caller; surfacing it through the chain would reject every
  // subsequent boot just because this one failed.
  bootChainByApiName.set(
    apiName,
    queued.catch(() => {}),
  );
  return promise;
}

async function bootTtscOnce(
  options: IBootTtscOptions,
  apiName: string,
  signal: AbortSignal,
): Promise<IBootResult> {
  const wasmUrl = options.wasmUrl;
  const wasmExecUrl = options.wasmExecUrl ?? defaultWasmExecUrl(wasmUrl);
  let phase = "preparing the wasm host";
  const cancellation = createBootCancellationPromise(
    signal,
    apiName,
    () => phase,
  );
  let readyCb: (() => void) | undefined;
  let failedCb: ((err: unknown) => void) | undefined;
  let runtimeStarted = false;

  const host = options.host ?? createMemFS();
  const globalAny = globalThis as Record<string, unknown>;
  // Install fs / process only if they aren't already in place, and remember
  // whether THIS attempt installed them. The Go runtime this boot starts reads
  // `globalThis.fs` when it runs, so the returned `host` must be the exact host
  // backing those globals. A caller booting a second wasm over the same MemFS
  // (or reusing one host across retries) reuses the same shims. When an earlier
  // failed attempt already installed a different host's shims, those are torn
  // down on failure below so this attempt can install its own.
  const installedFs = !globalAny.fs;
  const installedProcess = !globalAny.process;
  let processShim: unknown;
  if (installedFs) globalAny.fs = host.fs;
  if (installedProcess) {
    processShim = createProcessShim();
    globalAny.process = processShim;
  }

  // Any failure after global installation must leave the globals as this
  // attempt found them, so a retry installs its own host's fs (and the returned
  // host keeps matching the runtime's filesystem). Only remove what we
  // installed and only while it is still ours — never stomp a foreign fs or one
  // a concurrently-booted runtime already claimed.
  const restoreGlobals = (): void => {
    if (installedFs && globalAny.fs === host.fs) delete globalAny.fs;
    if (installedProcess && globalAny.process === processShim)
      delete globalAny.process;
  };

  try {
    throwIfBootCanceled(signal, apiName, phase);
    // wasm_exec.js installs `globalThis.Go`. It also reads globalThis.fs at
    // module-eval time, so this import must follow the assignment above.
    phase = `loading ${wasmExecUrl}`;
    importScripts(wasmExecUrl);
    // importScripts is synchronous and therefore cannot be interrupted while
    // the script evaluates. Observe a cancellation that arrived around that
    // boundary before starting any asynchronous work.
    throwIfBootCanceled(signal, apiName, phase);

    // Race the Ready resolver against a Failed signal so a wasm-side fault
    // (e.g. `host.Expose` refusing a duplicate call) surfaces here instead of
    // hanging on `await ready` forever.
    const ready = new Promise<void>((resolve, reject) => {
      readyCb = () => {
        delete globalAny[apiName + "Failed"];
        resolve();
      };
      failedCb = (err: unknown) => {
        delete globalAny[apiName + "Ready"];
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      globalAny[apiName + "Ready"] = readyCb;
      globalAny[apiName + "Failed"] = failedCb;
    });

    const goCtor = (globalAny as { Go?: new () => IGoInstance }).Go;
    if (typeof goCtor !== "function") {
      throw new Error(
        `bootTtsc: globalThis.Go was not installed by ${wasmExecUrl} — the file may not have loaded (CSP block, wrong content type, 404), or it is not the wasm_exec.js shipped with the Go toolchain.`,
      );
    }
    const go = new goCtor();

    phase = `fetching ${wasmUrl}`;
    const response = await raceBootCancellation(
      fetch(wasmUrl, { signal }),
      cancellation.promise,
      signal,
      apiName,
      () => phase,
    );
    if (!response.ok) {
      throw new Error(
        `bootTtsc: failed to fetch ${wasmUrl}: ${response.status}`,
      );
    }
    phase = `instantiating ${wasmUrl}`;
    const wasm = await raceBootCancellation(
      WebAssembly.instantiateStreaming(response, go.importObject),
      cancellation.promise,
      signal,
      apiName,
      () => phase,
    );

    // A normal host keeps `go.run` pending forever after signaling Ready, so a
    // settlement (fulfil OR reject) BEFORE Ready means the Go runtime exited or
    // panicked before it could register — e.g. an early `host.Expose` panic
    // that never reached the Failed bridge. Race that early exit against
    // readiness so the boot rejects with an actionable cause instead of hanging.
    // The standard Go runner discards the exit code, so an unknown early exit
    // can only synthesize a generic message; known host validation failures
    // reject through Failed above and keep their original cause.
    runtimeStarted = true;
    const runPromise = Promise.resolve(go.run(wasm.instance));
    const earlyExit = runPromise.then(
      () => {
        throw new Error(
          `bootTtsc: the ${apiName} wasm runtime exited before signaling readiness (the host may have panicked; check the wasm stderr).`,
        );
      },
      (err: unknown) => {
        throw new Error(
          `bootTtsc: the ${apiName} wasm runtime failed before signaling readiness: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      },
    );
    // When Ready wins, the long-running runtime's eventual `go.run` settlement
    // must not surface as an unhandled rejection. Attach a terminal handler to
    // the losing branch.
    earlyExit.catch(() => {});

    phase = `waiting for ${apiName} readiness`;
    await raceBootCancellation(
      Promise.race([ready, earlyExit]),
      cancellation.promise,
      signal,
      apiName,
      () => phase,
    );

    const api = (globalAny as Record<string, ITtscApi | undefined>)[apiName];
    if (!api)
      throw new Error(
        `bootTtsc: ${apiName} global was not set — was the wasm built with host.Expose(${JSON.stringify(apiName)}, ...)?`,
      );
    return { api, host };
  } catch (err) {
    restoreGlobals();
    if (runtimeStarted) throw poisonBootWorker(apiName, err);
    throw err;
  } finally {
    cancellation.dispose();
    // Drop this attempt's readiness bridge on every path so failed fetches,
    // instantiation failures, and cancellations cannot poison the next boot.
    if (globalAny[apiName + "Ready"] === readyCb)
      delete globalAny[apiName + "Ready"];
    if (globalAny[apiName + "Failed"] === failedCb)
      delete globalAny[apiName + "Failed"];
  }
}

function throwIfBootWorkerTerminated(apiName: string): void {
  const failure = terminalBootFailuresByApiName.get(apiName);
  if (failure) throw failure;
}

function poisonBootWorker(
  apiName: string,
  cause: unknown,
): BootTtscWorkerTerminationError {
  const existing = terminalBootFailuresByApiName.get(apiName);
  if (existing) return existing;
  const failure = new BootTtscWorkerTerminationError(apiName, cause);
  terminalBootFailuresByApiName.set(apiName, failure);
  return failure;
}

interface BootCancellation {
  promise: Promise<never>;
  dispose: () => void;
}

/**
 * Couple every caller's cancellation policy to the shared single-flight. A
 * duplicate caller is joining the same mutable boot, so its cancellation
 * cancels that shared attempt rather than pretending only one waiter left.
 */
function attachBootCancellation(
  entry: BootInFlight,
  callerSignal: AbortSignal | undefined,
): void {
  const abortFromCaller = (): void => {
    if (!entry.controller.signal.aborted)
      entry.controller.abort({
        kind: "abort",
        reason: callerSignal?.reason,
      } satisfies BootCancellationReason);
  };
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const cleanup = (): void => {
    callerSignal?.removeEventListener("abort", abortFromCaller);
  };
  void entry.promise.then(cleanup, cleanup);
}

function createBootCancellationPromise(
  signal: AbortSignal,
  apiName: string,
  getPhase: () => string,
): BootCancellation {
  let rejectCancellation!: (error: Error) => void;
  const promise = new Promise<never>((_resolve, reject) => {
    rejectCancellation = reject;
  });
  // Some synchronous boundaries observe cancellation with throwIfBootCanceled
  // before a Promise.race consumes this branch. Keep that rejection owned.
  void promise.catch(() => {});
  const onAbort = (): void => {
    rejectCancellation(bootCancellationError(signal, apiName, getPhase()));
  };
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
  return {
    promise,
    dispose: () => signal.removeEventListener("abort", onAbort),
  };
}

async function raceBootCancellation<T>(
  work: Promise<T>,
  cancellation: Promise<never>,
  signal: AbortSignal,
  apiName: string,
  getPhase: () => string,
): Promise<T> {
  try {
    return await Promise.race([work, cancellation]);
  } catch (error) {
    if (signal.aborted)
      throw bootCancellationError(signal, apiName, getPhase());
    throw error;
  }
}

function throwIfBootCanceled(
  signal: AbortSignal,
  apiName: string,
  phase: string,
): void {
  if (signal.aborted) throw bootCancellationError(signal, apiName, phase);
}

function bootCancellationError(
  signal: AbortSignal,
  apiName: string,
  phase: string,
): Error {
  const reason = signal.reason as BootCancellationReason | undefined;
  const error = new Error(`bootTtsc: aborted while ${phase} for ${apiName}.`);
  const cause = reason?.kind === "abort" ? reason.reason : signal.reason;
  if (cause !== undefined) (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

/**
 * Derive the `wasm_exec.js` URL from the wasm URL by replacing the filename.
 *
 * If `wasmUrl` has no directory component, returns `"wasm_exec.js"` (same
 * directory as the caller's base URL).
 */
function defaultWasmExecUrl(wasmUrl: string): string {
  const slash = wasmUrl.lastIndexOf("/");
  if (slash < 0) return "wasm_exec.js";
  return wasmUrl.slice(0, slash + 1) + "wasm_exec.js";
}

/**
 * Minimal shape of the `Go` constructor that `wasm_exec.js` exports on
 * `globalThis`. Only the members we actually use are typed here.
 */
interface IGoInstance {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

/**
 * Minimal `process` shim required by `wasm_exec.js` in non-Node environments.
 *
 * Go's js/wasm bridge reads `process.pid`, `process.ppid`, and calls
 * `process.cwd()`. `getuid`/`getgid` and friends return `-1` (root-less).
 * `umask` and `getgroups` are never exercised by the compiler but are included
 * for completeness so unexpected calls surface as clear errors.
 */
function createProcessShim(): Record<string, unknown> {
  return {
    getuid: () => -1,
    getgid: () => -1,
    geteuid: () => -1,
    getegid: () => -1,
    getgroups: () => {
      throw new Error("not implemented");
    },
    pid: -1,
    ppid: -1,
    umask: () => {
      throw new Error("not implemented");
    },
    cwd: () => "/",
    chdir: () => {
      /* no-op; the workspace lives inside the MemFS */
    },
  };
}
