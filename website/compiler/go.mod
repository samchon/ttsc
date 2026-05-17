module github.com/samchon/ttsc/website/compiler

go 1.26

// The website's playground wasm is a downstream consumer of @ttsc/wasm. It
// imports the host helper plus packages/ttsc/utility (the library backing
// banner/paths/strip) and wires them into a single wasm so the in-browser
// playground can drive the full first-party transform pipeline.
//
// Every shim/* replace mirrors packages/ttsc/go.mod because go.mod requires
// these directives to be self-contained — the workspace's go.work overlay
// also lists this module, but its replaces are independent.
replace (
	github.com/microsoft/typescript-go/shim/ast => ../../packages/ttsc/shim/ast
	github.com/microsoft/typescript-go/shim/bundled => ../../packages/ttsc/shim/bundled
	github.com/microsoft/typescript-go/shim/checker => ../../packages/ttsc/shim/checker
	github.com/microsoft/typescript-go/shim/compiler => ../../packages/ttsc/shim/compiler
	github.com/microsoft/typescript-go/shim/core => ../../packages/ttsc/shim/core
	github.com/microsoft/typescript-go/shim/diagnosticwriter => ../../packages/ttsc/shim/diagnosticwriter
	github.com/microsoft/typescript-go/shim/lsp => ../../packages/ttsc/shim/lsp
	github.com/microsoft/typescript-go/shim/parser => ../../packages/ttsc/shim/parser
	github.com/microsoft/typescript-go/shim/printer => ../../packages/ttsc/shim/printer
	github.com/microsoft/typescript-go/shim/scanner => ../../packages/ttsc/shim/scanner
	github.com/microsoft/typescript-go/shim/tsoptions => ../../packages/ttsc/shim/tsoptions
	github.com/microsoft/typescript-go/shim/tspath => ../../packages/ttsc/shim/tspath
	github.com/microsoft/typescript-go/shim/vfs => ../../packages/ttsc/shim/vfs
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs => ../../packages/ttsc/shim/vfs/cachedvfs
	github.com/microsoft/typescript-go/shim/vfs/osvfs => ../../packages/ttsc/shim/vfs/osvfs
	github.com/samchon/ttsc/packages/lint => ../../packages/lint
	github.com/samchon/ttsc/packages/ttsc => ../../packages/ttsc
	github.com/samchon/ttsc/packages/wasm => ../../packages/wasm
	github.com/samchon/typia/packages/typia/native => ../node_modules/typia/native
)

require (
	github.com/microsoft/typescript-go/shim/compiler v0.0.0
	github.com/microsoft/typescript-go/shim/scanner v0.0.0
	github.com/samchon/ttsc/packages/lint v0.0.0
	github.com/samchon/ttsc/packages/ttsc v0.0.0
	github.com/samchon/ttsc/packages/wasm v0.0.0
	github.com/samchon/typia/packages/typia/native v0.0.0
)

require (
	github.com/Microsoft/go-winio v0.6.2 // indirect
	github.com/go-json-experiment/json v0.0.0-20260214004413-d219187c3433 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/mackerelio/go-osstat v0.2.7 // indirect
	github.com/microsoft/typescript-go v0.0.0-20260429010842-56ab4af42157 // indirect
	github.com/microsoft/typescript-go/shim/ast v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/bundled v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/checker v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/core v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/diagnosticwriter v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/lsp v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/parser v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/printer v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/tsoptions v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/tspath v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/vfs v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/vfs/osvfs v0.0.0 // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	golang.org/x/sync v0.20.0 // indirect
	golang.org/x/sys v0.43.0 // indirect
	golang.org/x/text v0.36.0 // indirect
)
