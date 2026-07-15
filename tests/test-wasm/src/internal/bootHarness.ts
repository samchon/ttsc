// Node-side lifecycle harness for the real, built `bootTtsc`.
//
// `bootTtsc` runs in a Web Worker and reaches for `importScripts`, `fetch`,
// `WebAssembly.instantiateStreaming`, and the `Go` constructor that
// `wasm_exec.js` installs. None of those wasm mechanics are the subject under
// test — the *lifecycle* (readiness settlement, retry global restore) is. This
// harness stubs exactly those globals with a fake Go runtime whose behavior a
// test controls, drives the real imported `bootTtsc`, and restores every
// touched global afterward so sequential cases stay isolated.
//
// A successful `bootTtsc` deliberately leaves `globalThis.fs` installed, so the
// snapshot/restore below is load-bearing: without it, a boot that resolves in
// one case would leave `globalThis.fs` set and defeat the "install only when
// absent" path the retry cases depend on.

/** Controls handed to a fake `go.run` body so a case can steer readiness. */
export interface IFakeRuntime {
  /** The `apiName` this boot is waiting on. */
  readonly apiName: string;
  /** The exact `globalThis.fs` object visible to the runtime when it started. */
  readonly capturedFs: unknown;
  /** Bind `globalThis[apiName]` and fire the readiness resolver. */
  signalReady(api?: unknown): void;
  /** Fire the explicit `globalThis[apiName + "Failed"]` reject bridge. */
  signalFailed(error: unknown): void;
}

/** Behavior a case installs for one boot attempt sequence. */
export interface IBootStubOptions {
  /**
   * `Response.ok` status returned by successive `fetch` calls. A `< 400` status
   * is `ok`; `>= 400` drives the pre-`go.run` fetch-failure branch. Defaults to
   * a single `200`. The last entry repeats for any further calls.
   */
  fetchStatuses?: number[];
  /**
   * Fake `go.run` body, invoked once per attempt that reaches instantiation.
   * Return the promise that represents the Go runtime's lifetime: a normal host
   * returns a never-settling promise after `signalReady`; an early exit returns
   * a settled promise without signaling.
   */
  onRun: (runtime: IFakeRuntime) => Promise<void>;
}

type GlobalRecord = Record<string, unknown>;

/** A default fake API object so `signalReady()` binds something inspectable. */
export const FAKE_API = Object.freeze({ version: () => ({ version: "test" }) });

/**
 * Install the boot stubs, run `body` (which calls the real `bootTtsc`), and
 * restore every touched global — even on throw. Each case gets a clean slate.
 */
export async function withBootStubs<T>(
  apiName: string,
  options: IBootStubOptions,
  body: () => Promise<T>,
): Promise<T> {
  const g = globalThis as GlobalRecord;
  const keys = [
    "fs",
    "process",
    "Go",
    "importScripts",
    "fetch",
    apiName,
    apiName + "Ready",
    apiName + "Failed",
  ];
  // Snapshot presence + value so restore can distinguish "was absent" (delete)
  // from "was present" (reassign) — `process` genuinely exists in Node and must
  // survive untouched.
  const snapshot = new Map<string, { had: boolean; value: unknown }>();
  for (const key of keys)
    snapshot.set(key, { had: key in g, value: g[key] });
  const wasmDescriptor = Object.getOwnPropertyDescriptor(
    WebAssembly,
    "instantiateStreaming",
  );

  let fetchCall = 0;
  const statuses = options.fetchStatuses ?? [200];

  // `importScripts` is what installs the Go constructor in a Worker. Here it
  // installs a fake Go whose `run` defers to the case's `onRun`.
  g.importScripts = (): void => {
    class FakeGo {
      public importObject: WebAssembly.Imports = {} as WebAssembly.Imports;
      public run(): Promise<void> {
        const runtime: IFakeRuntime = {
          apiName,
          capturedFs: g.fs,
          signalReady(api: unknown = FAKE_API): void {
            g[apiName] = api;
            const cb = g[apiName + "Ready"];
            if (typeof cb === "function") (cb as () => void)();
          },
          signalFailed(error: unknown): void {
            const cb = g[apiName + "Failed"];
            if (typeof cb === "function")
              (cb as (e: unknown) => void)(error);
          },
        };
        return options.onRun(runtime);
      }
    }
    g.Go = FakeGo;
  };

  g.fetch = ((): Promise<{ ok: boolean; status: number }> => {
    const status = statuses[Math.min(fetchCall, statuses.length - 1)]!;
    fetchCall += 1;
    return Promise.resolve({ ok: status < 400, status });
  }) as unknown as typeof fetch;

  Object.defineProperty(WebAssembly, "instantiateStreaming", {
    configurable: true,
    writable: true,
    value: async () => ({
      instance: {} as WebAssembly.Instance,
      module: {} as WebAssembly.Module,
    }),
  });

  try {
    return await body();
  } finally {
    if (wasmDescriptor)
      Object.defineProperty(WebAssembly, "instantiateStreaming", wasmDescriptor);
    else
      delete (WebAssembly as unknown as GlobalRecord).instantiateStreaming;
    for (const [key, snap] of snapshot) {
      if (snap.had) g[key] = snap.value;
      else delete g[key];
    }
  }
}
