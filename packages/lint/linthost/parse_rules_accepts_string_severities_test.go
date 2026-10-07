package linthost

import (
  "testing"
)

// TestParseRulesAcceptsStringSeverities verifies that all supported string severity aliases
// are correctly mapped and that unconfigured rule names default to SeverityOff.
//
// The direct parser accepts "off", "warn", "warning" and "error". Both warning
// aliases map to SeverityWarn. An explicit off remains declared, while an
// unconfigured name has the same off lookup value without key membership.
//
// 1. Build a rules map with all four severity strings.
// 2. Parse through ParseRules.
// 3. Assert literal severities, explicit off membership, an absent rule and invalid-string rejection.
//
// @evidence contracts/testing.md#behavioral-verification ParseRules maps error, warning, warn and off, preserves explicit off membership, leaves an unlisted rule off and rejects unsupported strings.
// @evidence contracts/testing.md#independent-expectations The supported severity vocabulary determines each literal expectation; missing rules have the documented off default.
// @evidence contracts/testing.md#distinguishing-cases Long and short warning aliases contrast with invalid, empty and differently cased strings; explicit off remains declared while an unlisted name is absent. Numeric severities are owned by the adjacent numeric case.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Authored severity aliases and malformed strings call ParseRules directly in-process; returned levels and absent-rule off fallback are inspected without executing a compiler or consumer.
func TestParseRulesAcceptsStringSeverities(t *testing.T) {
  cfg, err := ParseRules(map[string]any{
    "no-var":                     "error",
    "typescript/no-explicit-any": "warning",
    "no-debugger":                "off",
    "eqeqeq":                     "warn",
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("noVar: want error, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("typescript/no-explicit-any") != SeverityWarn {
    t.Errorf("noExplicitAny: want warning, got %v", cfg.Severity("typescript/no-explicit-any"))
  }
  if cfg.Severity("no-debugger") != SeverityOff {
    t.Errorf("noDebugger: want off, got %v", cfg.Severity("no-debugger"))
  }
  if severity, declared := cfg["no-debugger"]; !declared || severity != SeverityOff {
    t.Errorf("explicit string off declaration was lost: %+v", cfg)
  }
  if cfg.Severity("eqeqeq") != SeverityWarn {
    t.Errorf("eqeqeq: want warning, got %v", cfg.Severity("eqeqeq"))
  }
  // Unconfigured rule defaults to off.
  if cfg.Severity("not-listed") != SeverityOff {
    t.Errorf("unlisted rule: want off, got %v", cfg.Severity("not-listed"))
  }
  if _, declared := cfg["not-listed"]; declared {
    t.Error("the parser invented an unlisted declaration")
  }

  for _, value := range []string{"", "fatal", "ERROR"} {
    if _, err := ParseRules(map[string]any{"invalid": value}); err == nil {
      t.Errorf("unsupported string severity %q was accepted", value)
    }
  }
}
