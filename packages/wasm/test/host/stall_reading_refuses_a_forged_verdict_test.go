//go:build js && wasm

package host_test

import (
  "syscall/js"
  "testing"
)

// TestStallReadingRefusesAForgedVerdict proves a reading that is not a list
// cannot spell the verdict that one of the two causes is decided by.
//
// `[]` says node holds nothing, which is the whole of the cause where node
// completed the write and the runtime failed to route the event. A reading
// that merely failed must not be able to write that sentence. A plain object
// is the shape that gets there by accident: it is an object like an array is,
// and reading an absent `length` off it yields zero, so the loop never runs
// and the rendering is indistinguishable from the verdict.
func TestStallReadingRefusesAForgedVerdict(t *testing.T) {
  rendered := describeJSList(js.Global().Call("eval", "({})"))
  if rendered == "[]" {
    t.Fatal("a non-list reading spelled the verdict")
  }
  if rendered != "<not a list>" {
    t.Fatalf("a non-list reading was not named: %s", rendered)
  }
}
