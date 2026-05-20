// Package host is the reusable Go scaffolding plugin authors import to build
// their own ttsc playground wasm.
//
// A consumer wasm looks like this:
//
//  //go:build js
//  package main
//
//  import (
//    "github.com/samchon/ttsc/packages/wasm/host"
//    yourplugin "example.com/your/plugin"
//  )
//
//  func main() {
//    // Expose never returns; it installs the JS API and blocks forever.
//    host.Expose("yourApi", host.Config{
//      Plugins: []host.Plugin{yourplugin.New()},
//    })
//  }
//
// Expose binds `globalThis[name]` to an object that exposes ttsc's base
// project commands (build, check, transform, version) plus a `plugin(name,
// command, opts)` dispatcher that routes into a Plugin's CLI-shaped Run
// callback. Plugins keep ttsc's existing argv-based contract — the same
// shape the native sidecars implement — so the wasm and the native CLI can
// share their Run* entry points byte-for-byte.
//
// The package is browser-agnostic: every JS-facing helper sits behind
// //go:build js, so a consumer can `go build ./...` natively without GOOS=js
// to keep CI happy.
package host
