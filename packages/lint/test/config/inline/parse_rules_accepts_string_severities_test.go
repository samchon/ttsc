package linthost

import (
  "testing"
)

// TestParseRulesAcceptsStringSeverities verifies that all supported string severity aliases
// are correctly mapped and that unrecognized rule names default to SeverityOff.
//
// The inline config accepts four string forms: "off", "warn", "warning", and "error". "warning"
// is a ttsc-specific alias for "warn" that does not exist in ESLint, so both must map to
// SeverityWarn. Unconfigured rules must default to SeverityOff so callers can safely ask for
// any rule's effective severity without checking for key presence.
//
// 1. Build a rules map with all four severity strings and one unconfigured rule key.
// 2. Parse through ParseRules.
// 3. Assert each string maps to the correct Severity and the missing rule returns SeverityOff.
func TestParseRulesAcceptsStringSeverities(t *testing.T) {
  cfg, err := ParseRules(map[string]any{
    "no-var":          "error",
    "no-explicit-any": "warning",
    "no-debugger":     "off",
    "eqeqeq":          "warn",
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("no-explicit-any") != SeverityWarn {
    t.Errorf("no-explicit-any: want warning, got %v", cfg.Severity("no-explicit-any"))
  }
  if cfg.Severity("no-debugger") != SeverityOff {
    t.Errorf("no-debugger: want off, got %v", cfg.Severity("no-debugger"))
  }
  if cfg.Severity("eqeqeq") != SeverityWarn {
    t.Errorf("eqeqeq: want warning, got %v", cfg.Severity("eqeqeq"))
  }
  // Unconfigured rule defaults to off.
  if cfg.Severity("not-listed") != SeverityOff {
    t.Errorf("unlisted rule: want off, got %v", cfg.Severity("not-listed"))
  }
}
