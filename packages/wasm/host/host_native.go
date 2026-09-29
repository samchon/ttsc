//go:build !js

// Stub implementations of JS-only host helpers for non-wasm targets.
// This file keeps the package importable by `go build ./...` on linux/darwin
// without GOOS=js, which native CI jobs need.
package host

// Expose is a no-op on native targets. The same function signature keeps
// host-importing native code buildable without GOOS=js. Files restricted to
// js/wasm still require that target to type-check their bodies.
//
// Calling this native alternative installs no JavaScript API and returns
// immediately, so native sanity entrypoints can import the host package.
//
// @evidence contracts/common.md#principled-implementation Go build constraints supply the native alternative to the js/wasm binding while retaining one signature.
// @evidence contracts/common.md#clear-and-simple-design A build-selected stub preserves import/type-check use of the host contract without inventing a native JavaScript runtime binding.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The no-op is an explicit native capability boundary rather than a fake installed JavaScript API.
// @evidence contracts/common.md#meaningful-documentation The Go declaration comment explains why the native symbol exists and does nothing under the documentation skill.
func Expose(apiName string, cfg Config) {
  _ = apiName
  _ = cfg
}
