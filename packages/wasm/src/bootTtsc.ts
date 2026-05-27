// Boots a host-built wasm and returns the JS-side handle.
//
// Order of operations matters: wasm_exec.js installs default no-op fs/process
// shims if `globalThis.fs` is missing at load time, so we must install our
// MemFS BEFORE importing wasm_exec.js.
//
// The boot helper is parameterized by `apiName` so any wasm built with
// `host.Expose(...)` can be loaded the same way. The base wasm uses "ttsc";
// downstream consumers pick their own (e.g. "ttscPlayground", "ttscTypia").

import { createMemFS } from "./createMemFS";
import type { IBootResult } from "./structures/IBootResult";
import type { IBootTtscOptions } from "./structures/IBootTtscOptions";
import type { ITtscApi } from "./structures/ITtscApi";

declare const importScripts: (...urls: string[]) => void;

/**
 * Per-(apiName, wasmUrl) single-flight cache for boots. Keying on apiName
 * alone would let a second call with the same apiName but a different
 * wasmUrl silently return the cached IBootResult of the first wasm — the
 * caller would think they booted a fresh binary while the cached one
 * stayed in place. The composite key lets HMR / cache-busting query
 * strings get a fresh boot while still single-flighting genuine concurrent
 * duplicate calls.
 */
const bootsInFlight = new Map<string, Promise<IBootResult>>();

/**
 * Per-apiName serialization chain. Two concurrent boots with the same
 * apiName but different wasmUrls each install their own `globalThis[apiName
 * + "Ready"]` resolver — they would race and the second would overwrite
 * the first, stranding the first boot's await. The chain serializes them
 * so one boot's Go-side `Ready.Invoke()` always lands on the resolver
 * that boot installed.
 */
const bootChainByApiName = new Map<string, Promise<unknown>>();

function bootKey(apiName: string, wasmUrl: string): string {
  return `${apiName}|${resolveWasmUrl(wasmUrl)}`;
}

/**
 * Resolve `wasmUrl` against the current document base before keying so
 * that `./playground.wasm`, `/compiler/playground.wasm`, and the fully
 * qualified absolute href all collapse to the same cache entry instead
 * of spawning duplicate boots. Falls back to the raw string when no
 * base is available (Node-side tests, non-DOM workers).
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
 * in-flight boot. Calls with the same `apiName` but different `wasmUrl`
 * are serialized via `bootChainByApiName` so they don't race on the
 * shared `globalThis[apiName+"Ready"]` resolver slot. On rejection the
 * cache entries are cleared so the next call retries from scratch.
 *
 * **Single-Worker caveat.** Even with the chain, a second boot loaded
 * into the SAME Worker after a first boot completes will overlay its
 * Go runtime on top of the first — `importScripts(wasmExecUrl)` rebinds
 * `globalThis.Go`, and the first wasm's keepalive goroutine keeps
 * running through the new runtime's js-bridge tables. The serialization
 * is sufficient for the typical use case (one boot per Worker over the
 * page's lifetime) but DOES NOT make a Worker safe to host two wasm
 * instances at once. Create a fresh Worker per concurrent wasm.
 */
export function bootTtsc(options: IBootTtscOptions): Promise<IBootResult> {
  const apiName = options.apiName ?? "ttsc";
  const key = bootKey(apiName, options.wasmUrl);
  const inflight = bootsInFlight.get(key);
  if (inflight) return inflight;
  const prior = bootChainByApiName.get(apiName) ?? Promise.resolve();
  const promise = prior
    .catch(() => {
      /* don't propagate a prior boot's rejection — let this one run */
    })
    .then(() => bootTtscOnce(options, apiName))
    .catch((err) => {
      bootsInFlight.delete(key);
      throw err;
    });
  bootsInFlight.set(key, promise);
  // Track the chain head for this apiName so the next boot waits on it.
  // Swallow on the chain head specifically: we already throw to the
  // immediate caller; surfacing it through the chain would reject every
  // subsequent boot just because this one failed.
  bootChainByApiName.set(
    apiName,
    promise.catch(() => {}),
  );
  return promise;
}

async function bootTtscOnce(
  options: IBootTtscOptions,
  apiName: string,
): Promise<IBootResult> {
  const wasmUrl = options.wasmUrl;
  const wasmExecUrl = options.wasmExecUrl ?? defaultWasmExecUrl(wasmUrl);

  const host = options.host ?? createMemFS();
  const globalAny = globalThis as Record<string, unknown>;
  // Only install fs / process if they aren't already in place. A caller
  // booting a second wasm over the same MemFS reuses the same shims.
  if (!globalAny.fs) globalAny.fs = host.fs;
  if (!globalAny.process) globalAny.process = createProcessShim();

  // wasm_exec.js installs `globalThis.Go`. It also reads globalThis.fs at
  // module-eval time, so this import must follow the assignment above.
  importScripts(wasmExecUrl);

  // Race the Ready resolver against a Failed signal so a wasm-side fault
  // (e.g. `host.Expose` refusing a duplicate call) surfaces here instead of
  // hanging on `await ready` forever. `go.run` is fire-and-forget so its
  // own rejection cannot reach this promise without an explicit channel.
  const ready = new Promise<void>((resolve, reject) => {
    globalAny[apiName + "Ready"] = () => {
      delete globalAny[apiName + "Failed"];
      resolve();
    };
    globalAny[apiName + "Failed"] = (err: unknown) => {
      delete globalAny[apiName + "Ready"];
      reject(err instanceof Error ? err : new Error(String(err)));
    };
  });

  const goCtor = (globalAny as { Go?: new () => IGoInstance }).Go;
  if (typeof goCtor !== "function") {
    throw new Error(
      `bootTtsc: globalThis.Go was not installed by ${wasmExecUrl} — the file may not have loaded (CSP block, wrong content type, 404), or it is not the wasm_exec.js shipped with the Go toolchain.`,
    );
  }
  const go = new goCtor();

  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`bootTtsc: failed to fetch ${wasmUrl}: ${response.status}`);
  }
  const wasm = await WebAssembly.instantiateStreaming(
    response,
    go.importObject,
  );
  // go.run never resolves until the wasm exits; we don't await it.
  void go.run(wasm.instance);
  await ready;

  const api = (globalAny as Record<string, ITtscApi | undefined>)[apiName];
  if (!api)
    throw new Error(
      `bootTtsc: ${apiName} global was not set — was the wasm built with host.Expose(${JSON.stringify(apiName)}, ...)?`,
    );
  return { api, host };
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
 * `umask` and `getgroups` are never exercised by the compiler but are
 * included for completeness so unexpected calls surface as clear errors.
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
