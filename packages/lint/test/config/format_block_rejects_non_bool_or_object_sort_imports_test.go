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
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects numeric sortImports 123 with a Boolean-or-object diagnostic.
// @evidence contracts/testing.md#independent-expectations Sort imports admits only Boolean shorthand or option objects; literal 123 supplies an independent unsupported-type input.
// @evidence contracts/testing.md#distinguishing-cases Owns numeric top-level sort value; true, false, and valid object variants are separately covered.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored numeric sortImports setting calls expandFormatBlock directly in-process; the Boolean-or-object error is observed without source sorting or a child compiler.
func TestFormatBlockRejectsNonBoolOrObjectSortImports(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"sortImports": 123})
  if err == nil {
    t.Fatal("expected error for non-bool/object sortImports, got nil")
  }
  if !strings.Contains(err.Error(), "boolean or object") {
    t.Errorf("expected error to state the boolean-or-object contract, got %v", err)
  }
}
