package main

import (
	"testing"
)

// TestParseRulesAcceptsLegacyNumericSeverities verifies parse rules accepts legacy numeric
// severities.
//
// Inline lint config is the native plugin contract carried inside the ttsc plugin entry. These
// tests verify severity parsing before any external ESLint-style config file is considered.
//
// This scenario focuses on parse rules accepts legacy numeric severities. It protects the
// strict inline-config shape so unsupported values fail loudly instead of being interpreted as
// ESLint flat-config tuples.
//
// 1. Build the inline rules object used by the host payload.
// 2. Parse it through the native severity normalizer.
// 3. Assert accepted severities or the explicit contract error.
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
