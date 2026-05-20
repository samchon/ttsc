//go:build !js

// Stub implementations of JS-only host helpers for non-wasm targets.
// This file keeps the package importable by `go build ./...` on linux/darwin
// without GOOS=js, which native CI jobs need.
package host

// Expose is a no-op on native targets. Consumers can `go build ./...` to
// type-check their wasm entry point without GOOS=js; the function symbol
// stays in scope but the body short-circuits so it's safe to call from a
// non-wasm sanity-test entrypoint.
func Expose(apiName string, cfg Config) {
  _ = apiName
  _ = cfg
}
