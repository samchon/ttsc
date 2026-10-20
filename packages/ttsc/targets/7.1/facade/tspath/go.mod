module github.com/microsoft/typescript-go/shim/tspath

go 1.27

require github.com/microsoft/TypeScript/tsc/shim/tspath v0.0.0

require github.com/microsoft/TypeScript/tsc v0.0.0-20261019224239-28534d760906 // indirect

replace github.com/microsoft/TypeScript/tsc/shim/tspath => ../../bridge/tspath
