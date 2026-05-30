package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonBoolOrObjectJsdoc verifies expandFormatBlock
// returns an error when the `jsDoc` field is neither a boolean nor an object.
//
// Locks the `default:` arm in the jsDoc type switch inside expandFormatBlock.
// The field accepts `true`, `false`, or a `{ tagSynonyms, sortTags }` object;
// any other type (e.g. a string or integer) must be rejected with an error
// message that names the expected types.
//
//  1. Call expandFormatBlock with `jsDoc: "enabled"` (string, not bool/object).
//  2. Assert an error is returned.
//  3. Assert the error message mentions `format.jsDoc`.
func TestFormatBlockRejectsNonBoolOrObjectJsdoc(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"jsDoc": "enabled"})
  if err == nil {
    t.Fatal("expected error for non-bool/non-object format.jsDoc, got nil")
  }
  if !strings.Contains(err.Error(), "format.jsDoc") {
    t.Errorf("expected error to mention format.jsDoc, got: %v", err)
  }
}
