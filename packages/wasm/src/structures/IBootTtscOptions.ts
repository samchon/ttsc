import type { IMemFSHost } from "./IMemFSHost";

/**
 * Options for `bootTtsc`. All fields except `wasmUrl` have defaults.
 *
 * @evidence contracts/common.md#principled-implementation
 *   URLs, AbortSignal and an injectable MemFS use browser integration primitives;
 *   the explicit API name mirrors the Go host's global bridge identity.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Runtime identity and host come from the caller or documented protocol defaults,
 *   without selecting a different boot path for a named consumer.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc explains defaults, cancellation sharing and host identity. Separate
 *   ownership paragraphs follow the documentation skill's context guidance.
 */
export interface IBootTtscOptions {
  /** URL of the .wasm to fetch. */
  wasmUrl: string;

  /** Cancel this boot attempt, including a shared in-flight attempt. */
  signal?: AbortSignal;

  /** URL of wasm_exec.js; defaults to a sibling URL without the binary's query/fragment. */
  wasmExecUrl?: string;

  /**
   * GlobalThis property name the wasm binds. Must match the value the wasm was
   * built with (the `apiName` passed to `host.Expose`). Defaults to `"ttsc"`.
   */
  apiName?: string;

  /**
   * Optional pre-existing MemFS host. A new boot creates one when omitted;
   * joining an existing boot reuses its host. A different explicit host or
   * runtime-script URL is rejected. Pass an existing host when you want to
   * retry before a runtime starts or reuse an existing boot's filesystem. This
   * does not make one Worker safe to host multiple Go runtimes simultaneously.
   */
  host?: IMemFSHost;
}
