package linthost

import "testing"

// TestParseExternalRuleEntryTreatsNullSecondSlotAsNoOptions verifies
// that an explicit JSON `null` in the options slot is treated as the
// no-options form.
//
// Some YAML and TOML-to-JSON serializers spell "no options" as a
// literal `null`. Marshaling the nil sentinel would store the four-byte
// text `null` as the options blob. That is harmless today (rule structs
// unmarshal `null` into the zero value) but a future `*bool` field would
// silently misbehave, so the parser special-cases the nil sentinel and keeps
// the options map clean. This test pins that behavior at the contract boundary.
//
// 1. Parse a `[severity, null]` tuple through the external parser.
// 2. Assert severity is captured.
// 3. Assert the options blob is empty (no `"null"` literal stored).
//
// @evidence contracts/testing.md#behavioral-verification parseExternalRuleEntry resolves warning severity but returns an empty option blob for an explicit null second slot.
// @evidence contracts/testing.md#independent-expectations A null options sentinel means no payload, rather than JSON text null; the independent expected byte count zero distinguishes absence from a serialized four-byte value.
// @evidence contracts/testing.md#distinguishing-cases Owns an explicit two-slot null tuple; populated ordered tails and one-slot severity forms are separate cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. A literal warning/null tuple reaches parseExternalRuleEntry directly in the shared Go process; severity and zero payload bytes observe sentinel handling without a config file or child host.
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
