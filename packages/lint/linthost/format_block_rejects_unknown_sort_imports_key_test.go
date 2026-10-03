package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsUnknownSortImportsKey verifies an unrecognized key
// inside the sortImports object is rejected.
//
// Locks the default arm of the per-key switch in expandSortImportsBlock. A
// typo'd nested key must surface at the boundary instead of being silently
// ignored.
//
//  1. Build sortImports with a bogus nested key.
//  2. Call expandFormatBlock.
//  3. Assert an error naming the offending key and the allowed surface.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects nested bogus key and identifies it plus an allowed order key.
// @evidence contracts/testing.md#independent-expectations Sort-import option objects admit a fixed public key set; the authored bogus field is independently invalid regardless of its Boolean value.
// @evidence contracts/testing.md#distinguishing-cases Owns unknown nested key versus valid values; valid complete object propagation is the accepted counterpart.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored nested bogus key calls expandFormatBlock directly in-process; offending and allowed key vocabulary are inspected without sorting source or invoking a host.
func TestFormatBlockRejectsUnknownSortImportsKey(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{
    "sortImports": map[string]any{"bogus": true},
  })
  if err == nil {
    t.Fatal("expected error for unknown sortImports key, got nil")
  }
  if !strings.Contains(err.Error(), "bogus") {
    t.Errorf("expected error to name the bogus key, got %v", err)
  }
  if !strings.Contains(err.Error(), "order") {
    t.Errorf("expected error to list the allowed keys, got %v", err)
  }
}
