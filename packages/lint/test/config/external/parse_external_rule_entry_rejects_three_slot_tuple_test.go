package linthost

import (
  "strings"
  "testing"
)

// TestParseExternalRuleEntryRejectsThreeSlotTuple verifies the
// `len(tuple) > 2` rejection branch for ESLint-flat-config inputs.
//
// Pre-Cycle-1, the external parser silently JSON-encoded the tail of
// 3+ element tuples as an array — but every built-in rule's option
// struct expects an object, so the array landed in `DecodeOptions` and
// fell back to defaults. Cycle-1 rejected the shape outright to keep
// parity with the inline parser's "no silent fallback" policy. This
// test pins the rejection so a regression cannot quietly resurrect the
// silent-fallback behavior.
//
// 1. Build an external-config rule entry with a 3-element tuple.
// 2. Parse it.
// 3. Assert the parser returns an error mentioning the tuple shape.
func TestParseExternalRuleEntryRejectsThreeSlotTuple(t *testing.T) {
  _, _, err := parseExternalRuleEntry([]any{
    "error",
    "double",
    map[string]any{"avoidEscape": true},
  })
  if err == nil {
    t.Fatalf("expected len-3 tuple to be rejected, got nil error")
  }
  if !strings.Contains(err.Error(), "[severity] or [severity, options]") {
    t.Fatalf("error should reference the supported tuple shapes, got %v", err)
  }
}
