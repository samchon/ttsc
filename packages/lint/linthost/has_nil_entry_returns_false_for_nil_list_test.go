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
//
// @evidence contracts/testing.md#behavioral-verification hasNilEntry must treat an absent list as containing no malformed entry.
// @evidence contracts/testing.md#independent-expectations A nil list has no operands to inspect, giving the independent false expectation.
// @evidence contracts/testing.md#distinguishing-cases The absent-list boundary complements the singleton nil and parsed valid list in TestHasNilEntryDistinguishesMalformedAndValidLists.
// @evidence contracts/testing.md#execution-ownership TestHasNilEntryReturnsFalseForNilList is one Go unit entry that calls the unexported hasNilEntry with a nil list pointer in-process; it parses no source and installs, builds and launches nothing.
func TestHasNilEntryReturnsFalseForNilList(t *testing.T) {
  if hasNilEntry(nil) {
    t.Fatalf("hasNilEntry(nil): expected false, got true")
  }
}
