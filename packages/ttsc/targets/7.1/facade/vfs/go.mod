module github.com/microsoft/typescript-go/shim/vfs

go 1.27

require (
	github.com/microsoft/TypeScript/tsc/shim/tspath v0.0.0
	github.com/microsoft/TypeScript/tsc/shim/vfs v0.0.0
)

require (
	github.com/microsoft/TypeScript/tsc v0.0.0-20261019224239-28534d760906 // indirect
	golang.org/x/sync v0.23.0 // indirect
	golang.org/x/sys v0.48.0 // indirect
)

replace github.com/microsoft/TypeScript/tsc/shim/tspath => ../../bridge/tspath

replace github.com/microsoft/TypeScript/tsc/shim/vfs => ../../bridge/vfs
