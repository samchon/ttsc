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
// the authored string must be rejected with a field-scoped error naming the
// expected types. Missing or nil values take the default path and are not
// rejection inputs in this test.
//
//  1. Call expandFormatBlock with `jsDoc: "enabled"` (string, not bool/object).
//  2. Assert an error is returned.
//  3. Assert the error mentions `format.jsDoc` and the Boolean-or-object types.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects string enabled as jsDoc and names format.jsDoc plus the Boolean-or-object contract.
// @evidence contracts/testing.md#independent-expectations JSDoc settings admit Boolean shorthand or an option object; an authored string must not be truthily coerced.
// @evidence contracts/testing.md#distinguishing-cases Owns invalid top-level JSDoc type; Boolean false and option-object customization execute separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored string jsDoc setting calls expandFormatBlock directly in-process; its field-scoped type error requires no JSDoc source input or native host.
func TestFormatBlockRejectsNonBoolOrObjectJsdoc(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"jsDoc": "enabled"})
  if err == nil {
    t.Fatal("expected error for non-bool/non-object format.jsDoc, got nil")
  }
  if !strings.Contains(err.Error(), "format.jsDoc") {
    t.Errorf("expected error to mention format.jsDoc, got: %v", err)
  }
  if !strings.Contains(err.Error(), "boolean or object") {
    t.Errorf("expected error to state the boolean-or-object contract, got: %v", err)
  }
}
