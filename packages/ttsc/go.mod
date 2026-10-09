module github.com/samchon/ttsc/packages/ttsc

go 1.27

// Maintained bridge and facade shim modules are resolved by these package-local
// replacements. Their pinned compiler dependency is resolved through the Go
// module cache; a sibling go.work or local upstream checkout is not required.
replace (
	github.com/microsoft/TypeScript/tsc/shim/ast => ./shim/ast
	github.com/microsoft/TypeScript/tsc/shim/astnav => ./shim/astnav
	github.com/microsoft/TypeScript/tsc/shim/bundled => ./shim/bundled
	github.com/microsoft/TypeScript/tsc/shim/checker => ./shim/checker
	github.com/microsoft/TypeScript/tsc/shim/compiler => ./shim/compiler
	github.com/microsoft/TypeScript/tsc/shim/core => ./shim/core
	github.com/microsoft/TypeScript/tsc/shim/diagnosticwriter => ./shim/diagnosticwriter
	github.com/microsoft/TypeScript/tsc/shim/lsp => ./shim/lsp
	github.com/microsoft/TypeScript/tsc/shim/parser => ./shim/parser
	github.com/microsoft/TypeScript/tsc/shim/printer => ./shim/printer
	github.com/microsoft/TypeScript/tsc/shim/scanner => ./shim/scanner
	github.com/microsoft/TypeScript/tsc/shim/stringutil => ./shim/stringutil
	github.com/microsoft/TypeScript/tsc/shim/transformers => ./shim/transformers
	github.com/microsoft/TypeScript/tsc/shim/tsoptions => ./shim/tsoptions
	github.com/microsoft/TypeScript/tsc/shim/tspath => ./shim/tspath
	github.com/microsoft/TypeScript/tsc/shim/vfs => ./shim/vfs
	github.com/microsoft/TypeScript/tsc/shim/vfs/cachedvfs => ./shim/vfs/cachedvfs
	github.com/microsoft/TypeScript/tsc/shim/vfs/osvfs => ./shim/vfs/osvfs
	github.com/microsoft/typescript-go/shim/ast => ./shim/typescript-go/ast
	github.com/microsoft/typescript-go/shim/astnav => ./shim/typescript-go/astnav
	github.com/microsoft/typescript-go/shim/bundled => ./shim/typescript-go/bundled
	github.com/microsoft/typescript-go/shim/checker => ./shim/typescript-go/checker
	github.com/microsoft/typescript-go/shim/compiler => ./shim/typescript-go/compiler
	github.com/microsoft/typescript-go/shim/core => ./shim/typescript-go/core
	github.com/microsoft/typescript-go/shim/diagnosticwriter => ./shim/typescript-go/diagnosticwriter
	github.com/microsoft/typescript-go/shim/lsp => ./shim/typescript-go/lsp
	github.com/microsoft/typescript-go/shim/parser => ./shim/typescript-go/parser
	github.com/microsoft/typescript-go/shim/printer => ./shim/typescript-go/printer
	github.com/microsoft/typescript-go/shim/scanner => ./shim/typescript-go/scanner
	github.com/microsoft/typescript-go/shim/stringutil => ./shim/typescript-go/stringutil
	github.com/microsoft/typescript-go/shim/transformers => ./shim/typescript-go/transformers
	github.com/microsoft/typescript-go/shim/tsoptions => ./shim/typescript-go/tsoptions
	github.com/microsoft/typescript-go/shim/tspath => ./shim/typescript-go/tspath
	github.com/microsoft/typescript-go/shim/vfs => ./shim/typescript-go/vfs
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs => ./shim/typescript-go/vfs/cachedvfs
	github.com/microsoft/typescript-go/shim/vfs/osvfs => ./shim/typescript-go/vfs/osvfs
)

require (
	github.com/microsoft/typescript-go/shim/ast v0.0.0
	github.com/microsoft/typescript-go/shim/bundled v0.0.0
	github.com/microsoft/typescript-go/shim/checker v0.0.0
	github.com/microsoft/typescript-go/shim/compiler v0.0.0
	github.com/microsoft/typescript-go/shim/core v0.0.0
	github.com/microsoft/typescript-go/shim/diagnosticwriter v0.0.0
	github.com/microsoft/typescript-go/shim/parser v0.0.0
	github.com/microsoft/typescript-go/shim/printer v0.0.0
	github.com/microsoft/typescript-go/shim/scanner v0.0.0
	github.com/microsoft/typescript-go/shim/stringutil v0.0.0
	github.com/microsoft/typescript-go/shim/tsoptions v0.0.0
	github.com/microsoft/typescript-go/shim/tspath v0.0.0
	github.com/microsoft/typescript-go/shim/vfs v0.0.0
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs v0.0.0
	github.com/microsoft/typescript-go/shim/vfs/osvfs v0.0.0
	golang.org/x/sys v0.48.0
)

require (
	github.com/Microsoft/go-winio v0.6.2 // indirect
	github.com/klauspost/compress v1.20.0 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/microsoft/TypeScript/tsc v0.0.0-20261008195036-6ad8c56f9b5a // indirect
	github.com/microsoft/TypeScript/tsc/shim/ast v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/bundled v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/checker v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/compiler v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/core v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/diagnosticwriter v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/parser v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/printer v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/scanner v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/stringutil v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/transformers v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/tsoptions v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/tspath v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/vfs v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/vfs/cachedvfs v0.0.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/vfs/osvfs v0.0.0 // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	golang.org/x/sync v0.23.0 // indirect
	golang.org/x/text v0.42.0 // indirect
)
