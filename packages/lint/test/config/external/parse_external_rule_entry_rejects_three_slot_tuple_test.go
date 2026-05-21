package linthost

import (
  "strings"
  "testing"
)

// TestParseExternalRuleEntryRejectsThreeSlotTuple verifies the
// `len(tuple) > 2` rejection branch for a config file's `rules` map.
//
// A `rules` entry must be a bare severity, `[severity]`, or `[severity,
// options]`. A 3+ element tuple silently JSON-encoded its tail as an array —
// but every built-in rule's option struct expects an object, so the array
// landed in `DecodeOptions` and fell back to defaults. The parser rejects the
// shape outright; this test pins the rejection so a regression cannot quietly
// resurrect the silent-fallback behavior.
//
// 1. Build a `rules`-map rule entry with a 3-element tuple.
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
