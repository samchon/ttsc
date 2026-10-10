module github.com/samchon/ttsc/packages/wasm

go 1.27

// The wasm package is a thin Go-side shell around `packages/ttsc/driver`.
// It re-uses the same shim/* tree that the native CLI ships with, so every
// replace directive mirrors `packages/ttsc/go.mod`. Without these, the
// public proxy cannot resolve the in-tree shim modules.
replace (
	github.com/microsoft/TypeScript/tsc/shim/ast => ../ttsc/shim/ast
	github.com/microsoft/TypeScript/tsc/shim/astnav => ../ttsc/shim/astnav
	github.com/microsoft/TypeScript/tsc/shim/bundled => ../ttsc/shim/bundled
	github.com/microsoft/TypeScript/tsc/shim/checker => ../ttsc/shim/checker
	github.com/microsoft/TypeScript/tsc/shim/compiler => ../ttsc/shim/compiler
	github.com/microsoft/TypeScript/tsc/shim/core => ../ttsc/shim/core
	github.com/microsoft/TypeScript/tsc/shim/diagnosticwriter => ../ttsc/shim/diagnosticwriter
	github.com/microsoft/TypeScript/tsc/shim/lsp => ../ttsc/shim/lsp
	github.com/microsoft/TypeScript/tsc/shim/parser => ../ttsc/shim/parser
	github.com/microsoft/TypeScript/tsc/shim/printer => ../ttsc/shim/printer
	github.com/microsoft/TypeScript/tsc/shim/scanner => ../ttsc/shim/scanner
	github.com/microsoft/TypeScript/tsc/shim/stringutil => ../ttsc/shim/stringutil
	github.com/microsoft/TypeScript/tsc/shim/transformers => ../ttsc/shim/transformers
	github.com/microsoft/TypeScript/tsc/shim/tsoptions => ../ttsc/shim/tsoptions
	github.com/microsoft/TypeScript/tsc/shim/tspath => ../ttsc/shim/tspath
	github.com/microsoft/TypeScript/tsc/shim/vfs => ../ttsc/shim/vfs
	github.com/microsoft/TypeScript/tsc/shim/vfs/cachedvfs => ../ttsc/shim/vfs/cachedvfs
	github.com/microsoft/TypeScript/tsc/shim/vfs/osvfs => ../ttsc/shim/vfs/osvfs
	github.com/microsoft/typescript-go/shim/ast => ../ttsc/shim/typescript-go/ast
	github.com/microsoft/typescript-go/shim/astnav => ../ttsc/shim/typescript-go/astnav
	github.com/microsoft/typescript-go/shim/bundled => ../ttsc/shim/typescript-go/bundled
	github.com/microsoft/typescript-go/shim/checker => ../ttsc/shim/typescript-go/checker
	github.com/microsoft/typescript-go/shim/compiler => ../ttsc/shim/typescript-go/compiler
	github.com/microsoft/typescript-go/shim/core => ../ttsc/shim/typescript-go/core
	github.com/microsoft/typescript-go/shim/diagnosticwriter => ../ttsc/shim/typescript-go/diagnosticwriter
	github.com/microsoft/typescript-go/shim/lsp => ../ttsc/shim/typescript-go/lsp
	github.com/microsoft/typescript-go/shim/parser => ../ttsc/shim/typescript-go/parser
	github.com/microsoft/typescript-go/shim/printer => ../ttsc/shim/typescript-go/printer
	github.com/microsoft/typescript-go/shim/scanner => ../ttsc/shim/typescript-go/scanner
	github.com/microsoft/typescript-go/shim/stringutil => ../ttsc/shim/typescript-go/stringutil
	github.com/microsoft/typescript-go/shim/transformers => ../ttsc/shim/typescript-go/transformers
	github.com/microsoft/typescript-go/shim/tsoptions => ../ttsc/shim/typescript-go/tsoptions
	github.com/microsoft/typescript-go/shim/tspath => ../ttsc/shim/typescript-go/tspath
	github.com/microsoft/typescript-go/shim/vfs => ../ttsc/shim/typescript-go/vfs
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs => ../ttsc/shim/typescript-go/vfs/cachedvfs
	github.com/microsoft/typescript-go/shim/vfs/osvfs => ../ttsc/shim/typescript-go/vfs/osvfs
	github.com/samchon/ttsc/packages/ttsc => ../ttsc
)

require (
	github.com/microsoft/typescript-go/shim/ast v0.0.0
	github.com/microsoft/typescript-go/shim/astnav v0.0.0
	github.com/microsoft/typescript-go/shim/compiler v0.0.0
	github.com/microsoft/typescript-go/shim/scanner v0.0.0
	github.com/microsoft/typescript-go/shim/tspath v0.0.0
	github.com/samchon/ttsc/packages/ttsc v0.0.0
)

require (
	github.com/Microsoft/go-winio v0.6.2 // indirect
	github.com/klauspost/compress v1.20.0 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/microsoft/TypeScript/tsc v0.0.0-20261008195036-6ad8c56f9b5a // indirect
	github.com/microsoft/TypeScript/tsc/shim/ast v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/astnav v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/bundled v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/checker v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/compiler v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/core v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/diagnosticwriter v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/parser v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/printer v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/scanner v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/transformers v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/tsoptions v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/tspath v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/vfs v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/vfs/cachedvfs v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/vfs/osvfs v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/bundled v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/checker v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/core v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/diagnosticwriter v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/parser v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/printer v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/tsoptions v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/vfs v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/vfs/osvfs v0.0.0 // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	golang.org/x/sync v0.23.0 // indirect
	golang.org/x/sys v0.48.0 // indirect
	golang.org/x/text v0.42.0 // indirect
)
