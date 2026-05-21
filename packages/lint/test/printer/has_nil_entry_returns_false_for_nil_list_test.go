package linthost

import (
  "testing"
)

// TestHasNilEntryReturnsFalseForNilList verifies that hasNilEntry returns
// false when the list pointer itself is nil.
//
// The nil-list guard is the first branch of hasNilEntry. It is separate
// from the nil-entry branch so callers can safely call it before checking
// list contents. Existing tests always pass a non-nil list, so the guard
// was not covered.
//
// 1. Call hasNilEntry with a nil *NodeList pointer.
// 2. Assert the return value is false.
func TestHasNilEntryReturnsFalseForNilList(t *testing.T) {
  if hasNilEntry(nil) {
    t.Fatalf("hasNilEntry(nil): expected false, got true")
  }
}
