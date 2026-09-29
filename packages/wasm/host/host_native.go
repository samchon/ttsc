//go:build !js

// Stub implementations of JS-only host helpers for non-wasm targets.
// This file keeps the package importable by `go build ./...` on linux/darwin
// without GOOS=js, which native CI jobs need.
package host

// Expose is a no-op on native targets. Consumers can `go build ./...` to
// type-check their wasm entry point without GOOS=js; the function symbol
// stays in scope but the body short-circuits so it's safe to call from a
// non-wasm sanity-test entrypoint.
//
// @evidence contracts/common.md#principled-implementation Go build constraints supply the native alternative to the js/wasm binding while retaining one signature.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The no-op is an explicit native capability boundary rather than a fake installed JavaScript API.
// @evidence contracts/common.md#meaningful-documentation The Go declaration comment explains why the native symbol exists and does nothing under the documentation skill.
func Expose(apiName string, cfg Config) {
  _ = apiName
  _ = cfg
}
