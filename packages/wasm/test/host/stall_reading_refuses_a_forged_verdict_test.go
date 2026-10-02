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
//
// @evidence contracts/testing.md#behavioral-verification Renders a plain object through describeJSList and asserts the result is the explicit non-list marker rather than an empty list, so a reading that failed cannot spell the verdict that node holds nothing.
// @evidence contracts/testing.md#independent-expectations The expected marker is the literal the helper documents; an empty-looking object is the adversarial input.
// @evidence contracts/testing.md#distinguishing-cases A non-list object is the negative case; a real list and a throwing source are owned by the sibling tests.
// @evidence contracts/testing.md#execution-ownership Runs in the js/wasm test binary because it evaluates a JavaScript value through syscall/js.
func TestStallReadingRefusesAForgedVerdict(t *testing.T) {
  rendered := describeJSList(js.Global().Call("eval", "({})"))
  if rendered == "[]" {
    t.Fatal("a non-list reading spelled the verdict")
  }
  if rendered != "<not a list>" {
    t.Fatalf("a non-list reading was not named: %s", rendered)
  }
}
