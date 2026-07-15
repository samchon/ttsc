//go:build !js

// Non-wasm entry. The same binary built with GOOS=js GOARCH=wasm becomes the
// browser playground. For native targets we keep a small CLI sanity surface
// so `go run ./cmd/playground <plugin> <command> ...` exercises the plugin
// wrappers without booting the browser MemFS — useful for fixture smoke
// tests that pin the same Plugin.Run contract the wasm dispatches into.
package main

import (
  "context"
  "fmt"
  "os"

  "github.com/samchon/ttsc/packages/wasm/host"
)

func main() {
  args := os.Args[1:]
  if len(args) > 0 && (args[0] == "-v" || args[0] == "--version" || args[0] == "version") {
    fmt.Println("playground-wasm sanity build")
    return
  }
  plugins := []host.Plugin{
    newBannerPlugin(),
    newPathsPlugin(),
    newStripPlugin(),
    newLintPlugin(),
    newTypiaPlugin(),
  }
  if len(args) >= 2 {
    name, command := args[0], args[1]
    for _, p := range plugins {
      if p.Name() == name {
        result := host.InvokePlugin(context.Background(), p, command, args[2:])
        fmt.Fprint(os.Stdout, result.Stdout)
        fmt.Fprint(os.Stderr, result.Stderr)
        os.Exit(result.Code)
      }
    }
  }
  // Fall-through: still register the API so go run smoke-tests can verify
  // host.Expose links cleanly even off the wasm path.
  host.Expose("ttscPlayground", host.Config{Plugins: plugins})
  fmt.Fprintln(os.Stderr, "playground-wasm: native sanity build — use GOOS=js GOARCH=wasm to produce the browser binary")
  fmt.Fprintln(os.Stderr, "playground-wasm: pass `<plugin> <command> [args...]` to dispatch directly")
}
