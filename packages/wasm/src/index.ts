// Public entry point for `@ttsc/wasm`.
//
// Re-exports the boot helper, MemFS bridge, and typed API surface. Plugin
// authors and playground builders consume these. The Go-side scaffolding
// (`host/`) is shipped alongside on disk but loaded via `go build`, not
// imported from JS.

export { bootTtsc } from "./instantiate";
export type { IBootTtscOptions, IBootResult } from "./instantiate";

export { createMemFS, MemFSError } from "./MemFS";
export type { IMemFSHost, IWasmExecFS, IFileStats } from "./MemFS";

export type {
  ITtscApi,
  ITtscVersion,
  ITtscBuildOpts,
  ITtscPluginOpts,
  ITtscResult,
  ITtscCompileResult,
  ITtscTransformResult,
  ITtscDiagnostic,
} from "./api";
export { parseResult } from "./api";
