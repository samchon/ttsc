//go:build js && wasm

package host_test

import (
  "strings"
  "syscall/js"
  "testing"
)

// TestStallReadingSurvivesABrokenSource proves a failing reading keeps the one
// that matters.
//
// `getActiveResourcesInfo` is the discriminator and is taken first; the two
// internals after it are the ones likelier to misbehave, and an earlier
// arrangement let a failure there replace the whole answer with the failure.
// Losing the discriminator is losing the diagnosis, which is the only reason
// the guard runs at all.
//
// The source is broken deliberately rather than waited for, because a node
// that misbehaves on its own is exactly what cannot be arranged.
func TestStallReadingSurvivesABrokenSource(t *testing.T) {
  process := js.Global().Get("process")
  original := process.Get("_getActiveHandles")
  defer process.Set("_getActiveHandles", original)
  js.Global().Call("eval", "process._getActiveHandles = () => [null]")

  reading := nodePendingWork()
  if !strings.HasPrefix(reading, "getActiveResourcesInfo=[") {
    t.Fatalf("a later failure took the discriminator with it: %s", reading)
  }
  if !strings.Contains(reading, "panicked") {
    t.Fatalf("the broken reading was not reported: %s", reading)
  }
}
