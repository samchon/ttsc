package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonBoolOrObjectJsdoc verifies expandFormatBlock
// returns an error when the `jsdoc` field is neither a boolean nor an object.
//
// Locks the `default:` arm in the jsdoc type switch inside expandFormatBlock.
// The field accepts `true`, `false`, or a `{ tagSynonyms, sortTags }` object;
// any other type (e.g. a string or integer) must be rejected with an error
// message that names the expected types.
//
//  1. Call expandFormatBlock with `jsdoc: "enabled"` (string, not bool/object).
//  2. Assert an error is returned.
//  3. Assert the error message mentions `format.jsdoc`.
func TestFormatBlockRejectsNonBoolOrObjectJsdoc(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"jsdoc": "enabled"})
  if err == nil {
    t.Fatal("expected error for non-bool/non-object format.jsdoc, got nil")
  }
  if !strings.Contains(err.Error(), "format.jsdoc") {
    t.Errorf("expected error to mention format.jsdoc, got: %v", err)
  }
}
