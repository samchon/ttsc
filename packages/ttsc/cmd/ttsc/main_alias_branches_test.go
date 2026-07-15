package main

import "testing"

// TestMainAliasBranches verifies `.cts` project inputs remain build aliases.
//
// The top-level dispatcher treats extension-shaped arguments as build aliases
// so `ttsc ./tsconfig.cts` stays compatible with tsc-style invocations instead
// of being rejected as an unknown command.
//
// 1. Dispatch a `.cts` argument through the build alias path.
// 2. Let project discovery inspect the missing file.
// 3. Assert the build lane reports its command-error status.
func TestMainAliasBranches(t *testing.T) {
  code, _, _ := captureCommand(t, func() int {
    return run([]string{"project.cts"})
  })
  if code != 2 {
    t.Fatalf("cts build alias status mismatch: %d", code)
  }
}
