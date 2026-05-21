package linthost

import "testing"

// TestFormatBlockExpandsNilRawToEmptyMap verifies expandFormatBlock returns
// an empty map without error when called with a nil raw map.
//
// Locks the nil-guard at the top of expandFormatBlock. The function is called
// by LoadConfigResolver when the `format` config field is absent or nil; the
// guard ensures the caller receives an empty (but non-nil) rule map rather than
// a panic or an error.
//
//  1. Call expandFormatBlock(nil).
//  2. Assert no error is returned.
//  3. Assert the returned map is non-nil and empty.
func TestFormatBlockExpandsNilRawToEmptyMap(t *testing.T) {
  out, err := expandFormatBlock(nil)
  if err != nil {
    t.Fatalf("expandFormatBlock(nil): unexpected error: %v", err)
  }
  if out == nil {
    t.Fatal("expandFormatBlock(nil): returned nil map, want empty map")
  }
  if len(out) != 0 {
    t.Fatalf("expandFormatBlock(nil): want empty map, got %d entries", len(out))
  }
}
