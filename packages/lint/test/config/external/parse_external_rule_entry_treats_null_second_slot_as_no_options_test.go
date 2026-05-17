package linthost

import "testing"

// TestParseExternalRuleEntryTreatsNullSecondSlotAsNoOptions verifies
// that an explicit JSON `null` in the options slot is treated as the
// no-options form.
//
// Some YAML and TOML-to-JSON serializers spell "no options" as a
// literal `null`. Pre-Cycle-1, the parser called `json.Marshal(nil)`
// and ended up storing the four-byte string `"null"` as the options
// blob — harmless today (rule structs unmarshal `null` into the zero
// value) but a future `*bool` field would silently misbehave. Cycle-1
// special-cased the nil sentinel so the options map stays clean.
// This test pins that behavior at the contract boundary.
//
// 1. Parse a `[severity, null]` tuple through the external parser.
// 2. Assert severity is captured.
// 3. Assert the options blob is empty (no `"null"` literal stored).
func TestParseExternalRuleEntryTreatsNullSecondSlotAsNoOptions(t *testing.T) {
  sev, raw, err := parseExternalRuleEntry([]any{"warning", nil})
  if err != nil {
    t.Fatalf("parseExternalRuleEntry: %v", err)
  }
  if sev != SeverityWarn {
    t.Fatalf("severity: want warning, got %v", sev)
  }
  if len(raw) != 0 {
    t.Fatalf("options blob must be empty for [severity, null], got %q", string(raw))
  }
}
