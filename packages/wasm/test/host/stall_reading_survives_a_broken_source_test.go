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
// that misbehaves on its own is exactly what cannot be arranged. It throws
// rather than returning a bad shape, because a bad shape is now named instead
// of panicking, and the path this case exists for is the one that still ends
// in a panic: `Value.Call` routes a JS throw back into Go as one.
//
// All three sources are planted, not just the failing one, so the reading
// walks nothing live. The two internals return libuv handle and request
// wrappers, and the guard holds those only when the process is already lost;
// a case on the healthy path is not making that trade.
func TestStallReadingSurvivesABrokenSource(t *testing.T) {
  process := js.Global().Get("process")
  originals := map[string]js.Value{}
  for _, name := range []string{
    "getActiveResourcesInfo",
    "_getActiveRequests",
    "_getActiveHandles",
  } {
    originals[name] = process.Get(name)
  }
  defer func() {
    for name, original := range originals {
      process.Set(name, original)
    }
  }()
  js.Global().Call("eval", `
    process.getActiveResourcesInfo = () => ["Planted"];
    process._getActiveRequests = () => [];
    process._getActiveHandles = () => { throw new Error("boom") };
  `)

  reading := nodePendingWork()
  if !strings.Contains(reading, "getActiveResourcesInfo=[Planted]") {
    t.Fatalf("a later failure took the discriminator with it: %s", reading)
  }
  if !strings.Contains(reading, "panicked") {
    t.Fatalf("the broken reading was not reported: %s", reading)
  }
}
