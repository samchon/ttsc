package linthost

import (
  "testing"
)

// TestParseRulesAcceptsLegacyNumericSeverities verifies that ESLint-style numeric severities
// (0=off, 1=warn, 2=error) are accepted alongside the string forms.
//
// The native JSON protocol carries the plugin entry's rules map as deserialized `any` values.
// JSON numbers arrive as float64, so the parser must normalize float64(0/1/2) rather than
// comparing against integer literals. Dropping this path would break any host that sends numeric
// severities, which is legal in both ESLint flat config and the ttsc plugin descriptor.
//
// 1. Build a rules map with float64(0), float64(1), and float64(2) as values.
// 2. Parse through ParseRules.
// 3. Assert each maps to SeverityOff, SeverityWarn, and SeverityError respectively.
func TestParseRulesAcceptsLegacyNumericSeverities(t *testing.T) {
  cfg, err := ParseRules(map[string]any{
    "a": float64(0),
    "b": float64(1),
    "c": float64(2),
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("a") != SeverityOff || cfg.Severity("b") != SeverityWarn || cfg.Severity("c") != SeverityError {
    t.Errorf("numeric severities not parsed correctly: %+v", cfg)
  }
}
