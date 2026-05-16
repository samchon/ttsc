// Boots a host-built wasm and returns the JS-side handle.
//
// Order of operations matters: wasm_exec.js installs default no-op fs/process
// shims if `globalThis.fs` is missing at load time, so we must install our
// MemFS BEFORE importing wasm_exec.js.
//
// The boot helper is parameterized by `apiName` so any wasm built with
// `host.Expose(...)` can be loaded the same way. The base wasm uses "ttsc";
// downstream consumers pick their own (e.g. "ttscPlayground", "ttscTypia").

import { createMemFS, type IMemFSHost } from "./MemFS";
import type { ITtscApi } from "./api";

declare const importScripts: (...urls: string[]) => void;

export interface IBootTtscOptions {
  /** URL of the .wasm to fetch. */
  wasmUrl: string;
  /** URL of wasm_exec.js. Defaults to the same directory as wasmUrl. */
  wasmExecUrl?: string;
  /**
   * globalThis property name the wasm binds. Must match the value the wasm
   * was built with (the `apiName` passed to `host.Expose`). Defaults to
   * "ttsc".
   */
  apiName?: string;
  /**
   * Optional pre-existing MemFS host. When omitted, a fresh one is created
   * and stored on the returned BootResult. Pass an existing host when you
   * want to boot multiple wasms over the same filesystem (e.g. base ttsc +
   * a typia wasm) so they share project sources.
   */
  host?: IMemFSHost;
}

export interface IBootResult {
  api: ITtscApi;
  host: IMemFSHost;
}

/** Boot a host-built wasm. Re-entrant only if you reuse the same `host`. */
export async function bootTtsc(options: IBootTtscOptions): Promise<IBootResult> {
  const wasmUrl = options.wasmUrl;
  const wasmExecUrl = options.wasmExecUrl ?? defaultWasmExecUrl(wasmUrl);
  const apiName = options.apiName ?? "ttsc";

  const host = options.host ?? createMemFS();
  const globalAny = globalThis as Record<string, unknown>;
  // Only install fs / process if they aren't already in place. A caller
  // booting a second wasm over the same MemFS reuses the same shims.
  if (!globalAny.fs) globalAny.fs = host.fs;
  if (!globalAny.process) globalAny.process = createProcessShim();

  // wasm_exec.js installs `globalThis.Go`. It also reads globalThis.fs at
  // module-eval time, so this import must follow the assignment above.
  importScripts(wasmExecUrl);

  const ready = new Promise<void>((resolve) => {
    globalAny[apiName + "Ready"] = resolve;
  });

  const goCtor = (globalAny as { Go: new () => IGoInstance }).Go;
  const go = new goCtor();

  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(
      `bootTtsc: failed to fetch ${wasmUrl}: ${response.status}`,
    );
  }
  const wasm = await WebAssembly.instantiateStreaming(response, go.importObject);
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

function defaultWasmExecUrl(wasmUrl: string): string {
  const slash = wasmUrl.lastIndexOf("/");
  if (slash < 0) return "wasm_exec.js";
  return wasmUrl.slice(0, slash + 1) + "wasm_exec.js";
}

interface IGoInstance {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

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
