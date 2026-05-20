package main

import "testing"

// TestMainAliasBranches verifies main command aliases cover flag-shaped demo and cts project inputs.
//
// The top-level dispatcher treats extension-shaped arguments as build aliases
// while demo owns its own flag parser. These small branches keep compatibility
// with `ttsc ./tsconfig.cts`-style invocations and malformed demo flags.
//
// 1. Run demo with a missing flag value.
// 2. Dispatch a `.cts` argument through the build alias path.
// 3. Assert both routes fail through their intended parser.
func TestMainAliasBranches(t *testing.T) {
  code, _, _ := captureCommand(t, func() int {
    return run([]string{"demo", "--type"})
  })
  if code != 2 {
    t.Fatalf("demo flag status mismatch: %d", code)
  }
  code, _, _ = captureCommand(t, func() int {
    return run([]string{"project.cts"})
  })
  if code != 2 {
    t.Fatalf("cts build alias status mismatch: %d", code)
  }
}
