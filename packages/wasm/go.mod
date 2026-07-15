module github.com/samchon/ttsc/packages/wasm

go 1.26

// The wasm package is a thin Go-side shell around `packages/ttsc/driver`.
// It re-uses the same shim/* tree that the native CLI ships with, so every
// replace directive mirrors `packages/ttsc/go.mod`. Without these, the
// public proxy cannot resolve the in-tree shim modules.
replace (
	github.com/microsoft/typescript-go/shim/ast => ../ttsc/shim/ast
	github.com/microsoft/typescript-go/shim/bundled => ../ttsc/shim/bundled
	github.com/microsoft/typescript-go/shim/checker => ../ttsc/shim/checker
	github.com/microsoft/typescript-go/shim/compiler => ../ttsc/shim/compiler
	github.com/microsoft/typescript-go/shim/core => ../ttsc/shim/core
	github.com/microsoft/typescript-go/shim/diagnosticwriter => ../ttsc/shim/diagnosticwriter
	github.com/microsoft/typescript-go/shim/lsp => ../ttsc/shim/lsp
	github.com/microsoft/typescript-go/shim/parser => ../ttsc/shim/parser
	github.com/microsoft/typescript-go/shim/printer => ../ttsc/shim/printer
	github.com/microsoft/typescript-go/shim/scanner => ../ttsc/shim/scanner
	github.com/microsoft/typescript-go/shim/tsoptions => ../ttsc/shim/tsoptions
	github.com/microsoft/typescript-go/shim/tspath => ../ttsc/shim/tspath
	github.com/microsoft/typescript-go/shim/vfs => ../ttsc/shim/vfs
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs => ../ttsc/shim/vfs/cachedvfs
	github.com/microsoft/typescript-go/shim/vfs/osvfs => ../ttsc/shim/vfs/osvfs
	github.com/samchon/ttsc/packages/ttsc => ../ttsc
)

require (
	github.com/microsoft/typescript-go/shim/ast v0.0.0
	github.com/microsoft/typescript-go/shim/compiler v0.0.0
	github.com/microsoft/typescript-go/shim/scanner v0.0.0
	github.com/samchon/ttsc/packages/ttsc v0.0.0
)

require (
	github.com/go-json-experiment/json v0.0.0-20260214004413-d219187c3433 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/microsoft/typescript-go v0.0.0-20260429010842-56ab4af42157 // indirect
	github.com/microsoft/typescript-go/shim/bundled v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/checker v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/core v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/diagnosticwriter v0.0.0 // indirect
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
