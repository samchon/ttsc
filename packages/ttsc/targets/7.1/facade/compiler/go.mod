module github.com/microsoft/typescript-go/shim/compiler

go 1.27

require (
	github.com/microsoft/TypeScript/tsc/shim/ast v0.0.0
	github.com/microsoft/TypeScript/tsc/shim/compiler v0.0.0
	github.com/microsoft/TypeScript/tsc/shim/core v0.0.0
	github.com/microsoft/TypeScript/tsc/shim/printer v0.0.0
	github.com/microsoft/TypeScript/tsc/shim/transformers v0.0.0
	github.com/microsoft/TypeScript/tsc/shim/tspath v0.0.0
	github.com/microsoft/TypeScript/tsc/shim/vfs v0.0.0
)

require (
	github.com/Microsoft/go-winio v0.6.2 // indirect
	github.com/klauspost/compress v1.20.0 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/microsoft/TypeScript/tsc v0.0.0-20261019224239-28534d760906 // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	golang.org/x/sync v0.23.0 // indirect
	golang.org/x/sys v0.48.0 // indirect
	golang.org/x/text v0.42.0 // indirect
	github.com/microsoft/TypeScript/tsc/shim/tsoptions v0.0.0
)

replace github.com/microsoft/TypeScript/tsc/shim/ast => ../../bridge/ast

replace github.com/microsoft/TypeScript/tsc/shim/compiler => ../../bridge/compiler

replace github.com/microsoft/TypeScript/tsc/shim/core => ../../bridge/core

replace github.com/microsoft/TypeScript/tsc/shim/printer => ../../bridge/printer

replace github.com/microsoft/TypeScript/tsc/shim/transformers => ../../bridge/transformers

replace github.com/microsoft/TypeScript/tsc/shim/tspath => ../../bridge/tspath

replace github.com/microsoft/TypeScript/tsc/shim/vfs => ../../bridge/vfs

replace github.com/microsoft/TypeScript/tsc/shim/tsoptions => ../../bridge/tsoptions
