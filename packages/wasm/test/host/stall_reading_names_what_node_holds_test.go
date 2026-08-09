//go:build js && wasm

package host_test

import (
  "strings"
  "testing"
)

// TestStallReadingNamesWhatNodeHolds proves the guard's node reading works
// without making the guard fire.
//
// The reading is pure observation, so it can be taken at any moment; a case
// that arranged a real stall would hang the suite it exists to protect. What
// has to hold is that the discriminator is present and named: an occurrence is
// read by whether a pending file request appears here, so a reading that
// silently produced nothing would look exactly like the verdict "node holds
// nothing", which is one of the two causes.
func TestStallReadingNamesWhatNodeHolds(t *testing.T) {
  reading := nodePendingWork()
  if !strings.HasPrefix(reading, "getActiveResourcesInfo=[") {
    t.Fatalf("the discriminator is missing from the reading: %s", reading)
  }
  if strings.Contains(reading, "<not a list>") {
    t.Fatalf("a reading did not produce a list: %s", reading)
  }
  if strings.Contains(reading, "panicked") {
    t.Fatalf("the reading panicked: %s", reading)
  }
}
