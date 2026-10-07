package linthost

import "testing"

// TestParseExternalRuleEntryTreatsNullSecondSlotAsNoOptions verifies
// that an explicit JSON `null` in the options slot is treated as the
// no-options form.
//
// A two-slot tuple uses its explicit null as an absent-options sentinel.
// Encoding that sentinel instead would produce the nonempty four-byte
// payload `null`; the parser must preserve absence rather than manufacture a
// payload for the owning rule. This body observes the returned blob only,
// without exercising serializers or rule-specific option decoding.
// The warning severity remains independent of that absent payload.
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
