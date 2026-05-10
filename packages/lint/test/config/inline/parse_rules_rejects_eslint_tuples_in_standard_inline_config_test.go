package main

import (
	"strings"
	"testing"
)

// TestParseRulesRejectsESLintTuplesInStandardInlineConfig verifies parse rules rejects ESLint
// tuples in standard inline config.
//
// Inline lint config is the native plugin contract carried inside the ttsc plugin entry. These
// tests verify severity parsing before any external ESLint-style config file is considered.
//
// This scenario focuses on parse rules rejects ESLint tuples in standard inline config. It
// protects the strict inline-config shape so unsupported values fail loudly instead of being
// interpreted as ESLint flat-config tuples.
//
// 1. Build the inline rules object used by the host payload.
// 2. Parse it through the native severity normalizer.
// 3. Assert accepted severities or the explicit contract error.
func TestParseRulesRejectsESLintTuplesInStandardInlineConfig(t *testing.T) {
	_, err := ParseRules(map[string]any{
		"no-var": []any{"error", map[string]any{"ignore": true}},
	})
	if err == nil {
		t.Fatal("expected standard inline config to reject ESLint tuple values")
	}
	if !strings.Contains(err.Error(), "severity must be one of") {
		t.Fatalf("error should explain standard severity contract, got %v", err)
	}
}
