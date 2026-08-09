// This go.mod is for LOCAL Go tooling only (gopls, `go test ./native`).
//
// ttsc does NOT use it: at build time ttsc copies the ./native package into
// @ttsc/lint's own Go module as a sub-package (contrib/evidence) and supplies
// every dependency from a generated go.work that overlays the installed ttsc
// package and its shim modules. A contributor therefore ships Go SOURCE, never
// a module — ttsc rejects a go.mod that sits inside the `source` directory
// itself, which is why this file lives one level above ./native and is
// excluded from what ttsc copies.
//
// In this workspace the replace directives point at the sibling packages, so
// the Go tests compile against the ttsc and @ttsc/lint sources in this tree
// rather than a published release. That is the reason the package lives here.
module github.com/samchon/ttsc/packages/evidence

go 1.26

require (
	github.com/microsoft/typescript-go/shim/ast v0.0.0
	github.com/microsoft/typescript-go/shim/core v0.0.0
	github.com/microsoft/typescript-go/shim/parser v0.0.0
	github.com/samchon/ttsc/packages/lint v0.0.0
)

require (
	github.com/go-json-experiment/json v0.0.0-20260214004413-d219187c3433 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/microsoft/typescript-go v0.0.0-20260429010842-56ab4af42157 // indirect
	github.com/microsoft/typescript-go/shim/checker v0.0.0 // indirect
	github.com/microsoft/typescript-go/shim/scanner v0.0.0 // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	golang.org/x/sync v0.20.0 // indirect
	golang.org/x/sys v0.43.0 // indirect
	golang.org/x/text v0.36.0 // indirect
)

replace (
	github.com/microsoft/typescript-go/shim/ast => ../ttsc/shim/ast
	github.com/microsoft/typescript-go/shim/bundled => ../ttsc/shim/bundled
	github.com/microsoft/typescript-go/shim/checker => ../ttsc/shim/checker
	github.com/microsoft/typescript-go/shim/compiler => ../ttsc/shim/compiler
	github.com/microsoft/typescript-go/shim/core => ../ttsc/shim/core
	github.com/microsoft/typescript-go/shim/diagnosticwriter => ../ttsc/shim/diagnosticwriter
	github.com/microsoft/typescript-go/shim/parser => ../ttsc/shim/parser
	github.com/microsoft/typescript-go/shim/scanner => ../ttsc/shim/scanner
	github.com/microsoft/typescript-go/shim/tsoptions => ../ttsc/shim/tsoptions
	github.com/microsoft/typescript-go/shim/tspath => ../ttsc/shim/tspath
	github.com/microsoft/typescript-go/shim/vfs => ../ttsc/shim/vfs
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs => ../ttsc/shim/vfs/cachedvfs
	github.com/microsoft/typescript-go/shim/vfs/osvfs => ../ttsc/shim/vfs/osvfs
	github.com/samchon/ttsc/packages/lint => ../lint
	github.com/samchon/ttsc/packages/ttsc => ../ttsc
)
