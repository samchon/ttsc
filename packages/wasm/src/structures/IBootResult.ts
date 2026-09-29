import type { IMemFSHost } from "./IMemFSHost";
import type { ITtscApi } from "./ITtscApi";

/**
 * Handle returned by `bootTtsc` once the wasm is ready.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Pairing the typed bridge and the exact MemFS host preserves the runtime's
 *   filesystem identity instead of exposing the API separately from its inputs.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The result pairs the two objects needed to seed and invoke this runtime;
 *   loading options and mutable boot coordination remain outside the handle.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The host is the booted runtime's actual backing object, not an unrelated
 *   replacement presented to a consumer after readiness.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native member JSDoc explains bridge and shared filesystem ownership, following
 *   the documentation skill's requirement for nonobvious usage context.
 */
export interface IBootResult {
  /** The typed API object bound by the wasm to `globalThis[apiName]`. */
  api: ITtscApi;

  /** The MemFS instance shared with the wasm's virtual filesystem. */
  host: IMemFSHost;
}
