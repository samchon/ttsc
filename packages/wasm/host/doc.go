// Package host is the reusable Go scaffolding plugin authors import to build
// their own ttsc playground wasm.
//
// A consumer wasm looks like this:
//
//  //go:build js && wasm
//  package main
//
//  import (
//    "github.com/samchon/ttsc/packages/wasm/host"
//    yourplugin "example.com/your/plugin"
//  )
//
//  func main() {
//    // A valid registration installs the JS API until Worker termination.
//    host.Expose("yourApi", host.Config{
//      Plugins: []host.Plugin{yourplugin.New()},
//    })
//  }
//
// Expose binds `globalThis[name]` to an object that exposes ttsc's base
// project commands (build, check, transform, version), the retained-program
// queries (snapshot and the get* verbs), `plugins()`, and
// `plugin({ name, command, ...opts })`, which routes into a Plugin's
// CLI-shaped Run callback. Every async endpoint returns the JS result envelope;
// build/check/transform place JSON payloads in `result`, while plugin output
// is captured in stdout/stderr. Plugins keep ttsc's existing argv-based
// contract — the same shape the native sidecars implement — so the wasm and
// the native CLI can share their Run* entry points byte-for-byte.
//
// JavaScript bindings use //go:build js && wasm. A native build selects a
// no-op Expose with the same signature and the shared project/plugin helpers;
// checking the bodies of js/wasm-only files requires a js/wasm build.
package host
