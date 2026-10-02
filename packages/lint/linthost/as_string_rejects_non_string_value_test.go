package linthost

import (
  "strings"
  "testing"
)

// TestAsStringRejectsNonStringValue verifies rejection of integer 42 and
// preservation of the string lf.
//
// The malformed input must report the supplied format.trailingComma
// field label. The valid string uses format.endOfLine as its label;
// this direct helper fixture does not validate either option vocabulary.
//
// @evidence contracts/testing.md#behavioral-verification asString rejects integer 42 with format.trailingComma context and preserves valid string lf for format.endOfLine.
// @evidence contracts/testing.md#independent-expectations String options do not stringify arbitrary values; the authored lf literal and offending field name independently establish preservation and rejection.
// @evidence contracts/testing.md#distinguishing-cases Owns numeric-versus-string input; allowed end-of-line and trailing-comma vocabularies are validated by their format-block cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit supplies integer 42 and literal lf directly to asString in the shared lint process, observing its returned value and field-named error without loading a consumer config or invoking a script host.
func TestAsStringRejectsNonStringValue(t *testing.T) {
  _, err := asString("format.trailingComma", 42)
  if err == nil {
    t.Fatal("asString(field, int): expected error, got nil")
  }
  if !strings.Contains(err.Error(), "format.trailingComma") {
    t.Errorf("asString error should name the field, got: %v", err)
  }

  got, err := asString("format.endOfLine", "lf")
  if err != nil {
    t.Fatalf("asString(field, \"lf\"): unexpected error: %v", err)
  }
  if got != "lf" {
    t.Fatalf("asString(field, \"lf\"): expected %q, got %q", "lf", got)
  }
}
