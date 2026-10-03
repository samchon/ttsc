//go:build !js

// Stub implementations of JS-only host helpers for non-wasm targets.
// This file keeps the package importable by `go build ./...` on linux/darwin
// without GOOS=js, which native CI jobs need.
package host

// expose is the native alternative behind Expose: it installs no JavaScript API
// and returns immediately.
func expose(apiName string, cfg Config) {
  _ = apiName
  _ = cfg
}
