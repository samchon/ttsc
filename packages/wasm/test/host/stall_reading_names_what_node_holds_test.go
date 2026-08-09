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
// has to hold is that the discriminator produces something and says so: an
// occurrence is read by whether a pending file request appears in it, and an
// empty list is not a neutral answer there but the affirmative verdict that
// node holds nothing. A reading that quietly produced nothing would spell that
// verdict, so the assertion is on content rather than on shape.
//
// Only the summary is taken. The full reading walks live node objects for
// per-handle detail, and a property that throws there ends the process with no
// Go output at all; the guard accepts that because it runs when the suite is
// already lost and the stacks are already written, which is not the trade a
// case on the healthy path makes.
func TestStallReadingNamesWhatNodeHolds(t *testing.T) {
  summary := nodeResourceSummary()
  if !strings.HasPrefix(summary, "[") || !strings.HasSuffix(summary, "]") {
    t.Fatalf("the discriminator produced no list: %s", summary)
  }
  if summary == "[]" {
    t.Fatalf("the discriminator produced the verdict rather than a reading: %s", summary)
  }
}
