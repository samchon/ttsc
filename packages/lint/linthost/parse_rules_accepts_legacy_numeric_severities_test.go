package linthost

import (
  "testing"
)

// TestParseRulesAcceptsLegacyNumericSeverities verifies that ESLint-style numeric severities
// (0=off, 1=warn, 2=error) are accepted alongside the string forms.
//
// JSON numeric values supplied to ParseRules arrive as float64. The direct
// parser must normalize float64(0/1/2) according to the supported severity
// contract rather than relying on the Go integer representation. This case
// supplies decoded values directly and does not exercise plugin descriptors.
//
// 1. Build a rules map with float64(0), float64(1), and float64(2) as values.
// 2. Parse through ParseRules.
// 3. Assert each maps to SeverityOff, SeverityWarn, and SeverityError respectively.
//
// @evidence contracts/testing.md#behavioral-verification ParseRules interprets JSON float64 severities as off, warning and error and rejects values outside those three integers.
// @evidence contracts/testing.md#independent-expectations The supported ESLint mapping is the literal 0/off, 1/warning and 2/error correspondence, independent of parser computation.
// @evidence contracts/testing.md#distinguishing-cases Valid zero, one and two contrast with negative, out-of-range and fractional numbers; the string case separately owns textual aliases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Authored valid and invalid numeric severities call ParseRules directly in-process; resulting levels and rejection errors are observed without JSON file loading or a host child.
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

  for _, value := range []float64{-1, 3, 0.5} {
    if _, err := ParseRules(map[string]any{"invalid": value}); err == nil {
      t.Errorf("unsupported numeric severity %v was accepted", value)
    }
  }
}
