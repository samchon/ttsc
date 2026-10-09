module github.com/microsoft/typescript-go/shim/astnav

go 1.27

require (
	github.com/microsoft/TypeScript/tsc/shim/ast v0.0.0
	github.com/microsoft/TypeScript/tsc/shim/astnav v0.0.0
)

require (
	github.com/klauspost/compress v1.20.0 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/microsoft/TypeScript/tsc v0.0.0-20261008195036-6ad8c56f9b5a // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	golang.org/x/sync v0.23.0 // indirect
	golang.org/x/sys v0.48.0 // indirect
	golang.org/x/text v0.42.0 // indirect
)

replace github.com/microsoft/TypeScript/tsc/shim/ast => ../../ast

replace github.com/microsoft/TypeScript/tsc/shim/astnav => ../../astnav
