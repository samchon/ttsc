package main

import (
	"testing"
)

// TestParseRulesAcceptsStringSeverities verifies parse rules accepts string severities.
//
// Inline lint config is the native plugin contract carried inside the ttsc plugin entry. These
// tests verify severity parsing before any external ESLint-style config file is considered.
//
// This scenario focuses on parse rules accepts string severities. It protects the strict
// inline-config shape so unsupported values fail loudly instead of being interpreted as ESLint
// flat-config tuples.
//
// 1. Build the inline rules object used by the host payload.
// 2. Parse it through the native severity normalizer.
// 3. Assert accepted severities or the explicit contract error.
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
