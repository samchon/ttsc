// Public entry point for `@ttsc/wasm`.
//
// Re-exports the boot helper, MemFS bridge, and typed API surface. Plugin
// authors and playground builders consume these. The Go-side scaffolding
// (`host/`) is shipped alongside on disk but loaded via `go build`, not
// imported from JS.

export * from "./bootTtsc";
export * from "./createMemFS";
export * from "./MemFSError";
export * from "./parseResult";
export * from "./structures/index";
