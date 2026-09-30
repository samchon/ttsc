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
//
// @evidence contracts/testing.md#behavioral-verification ParseRules maps error, warning, warn and off, leaves an unlisted rule off, and rejects unsupported strings.
// @evidence contracts/testing.md#independent-expectations The supported severity vocabulary determines each literal expectation; missing rules have the documented off default.
// @evidence contracts/testing.md#distinguishing-cases Long and short warning aliases contrast with invalid, empty and differently cased strings; numeric severities are owned by the adjacent numeric case.
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
  if cfg.Severity("eqeqeq") != SeverityWarn {
    t.Errorf("eqeqeq: want warning, got %v", cfg.Severity("eqeqeq"))
  }
  // Unconfigured rule defaults to off.
  if cfg.Severity("not-listed") != SeverityOff {
    t.Errorf("unlisted rule: want off, got %v", cfg.Severity("not-listed"))
  }

  for _, value := range []string{"", "fatal", "ERROR"} {
    if _, err := ParseRules(map[string]any{"invalid": value}); err == nil {
      t.Errorf("unsupported string severity %q was accepted", value)
    }
  }
}
