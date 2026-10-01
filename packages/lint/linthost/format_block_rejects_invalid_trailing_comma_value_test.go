package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsInvalidTrailingCommaValue verifies expandFormatBlock
// returns an error when `trailingComma` is a string but not one of the
// allowed values ("all", "es5", "none").
//
// Locks the `default:` branch of the trailingComma switch inside
// expandFormatBlock. After `asString` succeeds, the value is validated against
// the three allowed modes; any other value (e.g. "always") must be rejected
// with an error that names the field and lists the allowed options.
//
//  1. Call expandFormatBlock with `trailingComma: "always"`.
//  2. Assert an error is returned.
//  3. Assert the error message mentions the bad value.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects trailingComma always and identifies the field plus offending value.
// @evidence contracts/testing.md#independent-expectations The public comma modes are all, es5 and none; independently authored always lies outside that set and must not silently become a default.
// @evidence contracts/testing.md#distinguishing-cases Owns correct string type with unsupported vocabulary; wrong-type rejection and accepted es5 propagation are separate cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored trailingComma always object calls expandFormatBlock directly in-process; value and field errors are observed without source formatting or a native producer.
func TestFormatBlockRejectsInvalidTrailingCommaValue(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"trailingComma": "always"})
  if err == nil {
    t.Fatal("expected error for invalid format.trailingComma value, got nil")
  }
  if !strings.Contains(err.Error(), "trailingComma") || !strings.Contains(err.Error(), "always") {
    t.Errorf("expected error to mention trailingComma, got: %v", err)
  }
}
