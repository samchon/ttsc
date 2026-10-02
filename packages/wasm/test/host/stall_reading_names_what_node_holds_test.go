//go:build js && wasm

package host_test

import (
  "strings"
  "testing"
)

// TestStallReadingNamesWhatNodeHolds proves the discriminator produces a real
// list without making the guard fire.
//
// The reading is pure observation, so it can be taken at any moment; a case
// that arranged a real stall would hang the suite it exists to protect. What
// has to hold is that the reading produces a list at all, which is what tells
// a real answer from a source that was absent or gave back something else.
//
// An empty list is not asserted against. `[]` is the honest reading of an
// empty loop, and it is the likeliest thing the guard itself prints, because
// it runs inside the timer callback node used to resume the runtime and a
// healthy program parked there holds nothing. Calling it a broken reading here
// would teach whoever reads the eventual dump to discard the very answer the
// guard exists to produce, and would make this case depend on ambient loop
// state no part of the suite controls.
//
// Only the summary is taken. The full reading walks live node objects for
// per-handle detail, and a property that throws there ends the process with no
// Go output at all; the guard accepts that because it runs when the suite is
// already lost and the stacks are already written, which is not the trade a
// case on the healthy path makes.
//
// @evidence contracts/testing.md#behavioral-verification Calls nodeResourceSummary under node and asserts it renders a bracketed list, so a reading that fails to produce a list cannot pass.
// @evidence contracts/testing.md#independent-expectations The expected shape follows the rendering contract of describeJSList (a list is bracketed); the content is deliberately not asserted because it depends on ambient event-loop state.
// @evidence contracts/testing.md#distinguishing-cases A genuine list reading is the positive case; the non-list and throwing sources are owned by the two sibling stall tests.
// @evidence contracts/testing.md#execution-ownership Runs in the js/wasm test binary because it reads node's process object through syscall/js; no product host is started.
func TestStallReadingNamesWhatNodeHolds(t *testing.T) {
  summary := nodeResourceSummary()
  if !strings.HasPrefix(summary, "[") || !strings.HasSuffix(summary, "]") {
    t.Fatalf("the discriminator produced no list: %s", summary)
  }
}
