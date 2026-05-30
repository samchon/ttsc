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
