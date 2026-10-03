module go-source-plugin-managed-replace

go 1.26

replace github.com/microsoft/typescript-go/shim/printer => ./shim/printer

require (
	github.com/microsoft/typescript-go/shim/printer v0.0.0
	github.com/samchon/ttsc/packages/ttsc v0.0.0
)
