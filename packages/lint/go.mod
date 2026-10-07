module github.com/samchon/ttsc/packages/lint

go 1.26

// The plugin's TypeScript integration depends only on the
// `microsoft/typescript-go/shim/*` modules so that `go mod tidy` works against
// the public proxy. The bootstrap glue (Program creation, diagnostic
// rendering, emit) is
// inlined under ./plugin/host.go to avoid a transitive dependency on the
// in-tree `github.com/samchon/ttsc/packages/ttsc` module — that module
// has no public version tag and would only resolve through ttsc's
// scratch-dir go.work overlay, which conflicts with go.mod-level
// replace directives.

require (
	github.com/microsoft/typescript-go/shim/ast v0.0.0
	github.com/microsoft/typescript-go/shim/bundled v0.0.0
	github.com/microsoft/typescript-go/shim/checker v0.0.0
	github.com/microsoft/typescript-go/shim/compiler v0.0.0
	github.com/microsoft/typescript-go/shim/core v0.0.0
	github.com/microsoft/typescript-go/shim/diagnosticwriter v0.0.0
	github.com/microsoft/typescript-go/shim/parser v0.0.0
	github.com/microsoft/typescript-go/shim/scanner v0.0.0
	github.com/microsoft/typescript-go/shim/stringutil v0.0.0
	github.com/microsoft/typescript-go/shim/tsoptions v0.0.0
	github.com/microsoft/typescript-go/shim/tspath v0.0.0
	github.com/microsoft/typescript-go/shim/vfs v0.0.0
	github.com/microsoft/typescript-go/shim/vfs/cachedvfs v0.0.0
	github.com/microsoft/typescript-go/shim/vfs/osvfs v0.0.0
	golang.org/x/text v0.38.0
)

require (
	github.com/go-json-experiment/json v0.0.0-20260601182631-00ed12fed2a6 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/microsoft/typescript-go v0.0.0-20260610182825-7fc57c005063 // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	golang.org/x/sync v0.21.0 // indirect
	golang.org/x/sys v0.46.0 // indirect
)
