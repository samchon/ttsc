//go:build js && wasm

// Browser entry for the base `ttsc.wasm`. Ships ttsc + typescript-go only —
// no first-party plugins are linked here. Downstream playgrounds bundle their
// own plugins by writing their own `main_wasm.go` against the same host
// helper and producing a separate `.wasm`.
package main

import (
	"github.com/samchon/ttsc/packages/wasm/host"
)

func main() {
	host.Expose("ttsc", host.Config{
		Plugins: nil,
	})
}
