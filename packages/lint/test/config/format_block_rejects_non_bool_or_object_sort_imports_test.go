package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonBoolOrObjectSortImports verifies a sortImports value
// that is neither a boolean nor an object is rejected.
//
// Locks the default arm of the top-level type switch in expandSortImportsBlock.
// A number (or any non-bool, non-object) must surface as a typed error.
//
//  1. Call expandFormatBlock with sortImports set to a number.
//  2. Assert an error explaining the boolean-or-object contract.
func TestFormatBlockRejectsNonBoolOrObjectSortImports(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"sortImports": 123})
  if err == nil {
    t.Fatal("expected error for non-bool/object sortImports, got nil")
  }
  if !strings.Contains(err.Error(), "boolean or object") {
    t.Errorf("expected error to state the boolean-or-object contract, got %v", err)
  }
}
