import type { IMemFSHost } from "./IMemFSHost";
import type { ITtscApi } from "./ITtscApi";

/** Handle returned by `bootTtsc` once the wasm is ready. */
export interface IBootResult {
  /** The typed API proxy bound by the wasm to `globalThis[apiName]`. */
  api: ITtscApi;
  /** The MemFS instance shared with the wasm's virtual filesystem. */
  host: IMemFSHost;
}
