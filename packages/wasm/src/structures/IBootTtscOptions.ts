import type { IMemFSHost } from "./IMemFSHost";

/** Options for `bootTtsc`. All fields except `wasmUrl` have sensible defaults. */
export interface IBootTtscOptions {
  /** URL of the .wasm to fetch. */
  wasmUrl: string;
  /** URL of wasm_exec.js. Defaults to the same directory as wasmUrl. */
  wasmExecUrl?: string;
  /**
   * GlobalThis property name the wasm binds. Must match the value the wasm was
   * built with (the `apiName` passed to `host.Expose`). Defaults to `"ttsc"`.
   */
  apiName?: string;
  /**
   * Optional pre-existing MemFS host. When omitted, a fresh one is created and
   * stored on the returned BootResult. Pass an existing host when you want to
   * boot multiple wasms over the same filesystem (e.g. base ttsc + a typia
   * wasm) so they share project sources.
   */
  host?: IMemFSHost;
}
