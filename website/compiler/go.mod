module github.com/samchon/ttsc/website/compiler

go 1.27

// The website's playground wasm is a downstream consumer of @ttsc/wasm. It
// imports the host helper plus packages/ttsc/utility (the library backing
// banner/paths/strip) and wires them into a single wasm so the in-browser
// playground can drive the full first-party transform pipeline.
//
// Every shim/* replace mirrors packages/ttsc/go.mod because go.mod requires
// these directives to be self-contained — the workspace's go.work overlay
// also lists this module, but its replaces are independent.
replace (
	github.com/microsoft/TypeScript/tsc/shim/ast => ../../packages/ttsc/shim/ast
	github.com/microsoft/TypeScript/tsc/shim/astnav => ../../packages/ttsc/shim/astnav
	github.com/microsoft/TypeScript/tsc/shim/bundled => ../../packages/ttsc/shim/bundled
	github.com/microsoft/TypeScript/tsc/shim/checker => ../../packages/ttsc/shim/checker
	github.com/microsoft/TypeScript/tsc/shim/compiler => ../../packages/ttsc/shim/compiler
	github.com/microsoft/TypeScript/tsc/shim/core => ../../packages/ttsc/shim/core
	github.com/microsoft/TypeScript/tsc/shim/diagnosticwriter => ../../packages/ttsc/shim/diagnosticwriter
	github.com/microsoft/TypeScript/tsc/shim/lsp => ../../packages/ttsc/shim/lsp
	github.com/microsoft/TypeScript/tsc/shim/parser => ../../packages/ttsc/shim/parser
	github.com/microsoft/TypeScript/tsc/shim/printer => ../../packages/ttsc/shim/printer
	github.com/microsoft/TypeScript/tsc/shim/scanner => ../../packages/ttsc/shim/scanner
	github.com/microsoft/TypeScript/tsc/shim/stringutil => ../../packages/ttsc/shim/stringutil
	github.com/microsoft/TypeScript/tsc/shim/transformers => ../../packages/ttsc/shim/transformers
	github.com/microsoft/TypeScript/tsc/shim/tsoptions => ../../packages/ttsc/shim/tsoptions
	github.com/microsoft/TypeScript/tsc/shim/tspath => ../../packages/ttsc/shim/tspath
	github.com/microsoft/TypeScript/tsc/shim/vfs => ../../packages/ttsc/shim/vfs
	github.com/microsoft/TypeScript/tsc/shim/vfs/cachedvfs => ../../packages/ttsc/shim/vfs/cachedvfs
	github.com/microsoft/TypeScript/tsc/shim/vfs/osvfs => ../../packages/ttsc/shim/vfs/osvfs
	github.com/microsoft/typescript-go/shim/ast => ../../packages/ttsc/shim/typescript-go/ast
	github.com/microsoft/typescript-go/shim/astnav => ../../packages/ttsc/shim/typescript-go/astnav
	github.com/microsoft/typescript-go/shim/bundled => ../../packages/ttsc/shim/typescript-go/bundled
	github.com/microsoft/typescript-go/shim/checker => ../../packages/ttsc/shim/typescript-go/checker
	github.com/microsoft/typescript-go/shim/compiler => ../../packages/ttsc/shim/typescript-go/compiler
	github.com/microsoft/typescript-go/shim/core => ../../packages/ttsc/shim/typescript-go/core
	github.com/microsoft/typescript-go/shim/diagnosticwriter => ../../packages/ttsc/shim/typescript-go/diagnosticwriter
	github.com/microsoft/typescript-go/shim/lsp => ../../packages/ttsc/shim/typescript-go/lsp
	github.com/microsoft/typescript-go/shim/parser => ../../packages/ttsc/shim/typescript-go/parser
	github.com/microsoft/typescript-go/shim/printer => ../../packages/ttsc/shim/typescript-go/printer
	github.com/microsoft/typescript-go/shim/scanner => ../../packages/ttsc/shim/typescript-go/scanner
	github.com/microsoft/typescript-go/shim/stringutil => ../../packages/ttsc/shim/typescript-go/stringutil
	github.com/microsoft/typescript-go/shim/transformers => ../../packages/ttsc/shim/typescript-go/transformers
	github.com/microsoft/typescript-go/shim/tsoptions => ../../packages/ttsc/shim/typescript-go/tsoptions
	github.com/microsoft/typescript-go/shim/tspath => ../../packages/ttsc/shim/typescript-go/tspath
	github.com/microsoft/typescript-go/shim/vfs => ../../packages/ttsc/shim/typescript-go/vfs
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs => ../../packages/ttsc/shim/typescript-go/vfs/cachedvfs
	github.com/microsoft/typescript-go/shim/vfs/osvfs => ../../packages/ttsc/shim/typescript-go/vfs/osvfs
	github.com/samchon/ttsc/packages/lint => ../../packages/lint
	github.com/samchon/ttsc/packages/ttsc => ../../packages/ttsc
	github.com/samchon/ttsc/packages/wasm => ../../packages/wasm
	github.com/samchon/typia/packages/typia/native => ../node_modules/typia/native
)

require (
	github.com/microsoft/typescript-go/shim/ast v0.0.0
	github.com/microsoft/typescript-go/shim/compiler v0.0.0
	github.com/microsoft/typescript-go/shim/printer v0.0.0
	github.com/microsoft/typescript-go/shim/tspath v0.0.0
	github.com/samchon/ttsc/packages/lint v0.0.0
	github.com/samchon/ttsc/packages/ttsc v0.0.0
	github.com/samchon/ttsc/packages/wasm v0.0.0
	github.com/samchon/typia/packages/typia/native v0.0.0
)

require (
	github.com/go-json-experiment/json v0.0.0-20260601182631-00ed12fed2a6 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/microsoft/TypeScript/tsc v0.0.0-20261008195036-6ad8c56f9b5a // indirect
	github.com/microsoft/typescript-go/shim/astnav v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/bundled v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/checker v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/core v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/diagnosticwriter v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/parser v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/scanner v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/stringutil v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/tsoptions v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/vfs v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/vfs/osvfs v0.0.0 // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	golang.org/x/sync v0.21.0 // indirect
	golang.org/x/sys v0.46.0 // indirect
	golang.org/x/text v0.38.0 // indirect
)
