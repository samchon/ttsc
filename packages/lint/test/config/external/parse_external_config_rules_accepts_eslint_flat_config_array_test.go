package main

import (
	"testing"
)

// TestParseExternalConfigRulesAcceptsESLintFlatConfigArray verifies parse external config rules
// accepts ESLint flat config array.
//
// External config parsing accepts ESLint-style flat config data and reduces it into the lint
// engine rule model. These tests cover file matching, ignores, extends reduction, and
// runtime-only markers before the command path loads a real project.
//
// This scenario focuses on parse external config rules accepts ESLint flat config array. It
// protects the boundary between native fallback rules and cases that must delegate to an
// installed ESLint runtime.
//
// 1. Create the external config object or array for the branch.
// 2. Parse it through the external config reducer or store builder.
// 3. Assert resolved rules, ignored files, or runtime-required flags.
func TestParseExternalConfigRulesAcceptsESLintFlatConfigArray(t *testing.T) {
	cfg, err := parseExternalConfigRules([]any{
		map[string]any{
			"name": "base",
			"rules": map[string]any{
				"no-var":     "error",
				"no-console": "warn",
			},
		},
		map[string]any{
			"files": []any{"src/**/*.ts"},
			"rules": map[string]any{
				"no-console":                         "off",
				"@typescript-eslint/no-explicit-any": "error",
			},
		},
		map[string]any{
			"ignores": []any{"dist/**"},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Severity("no-var") != SeverityError {
		t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
	}
	if cfg.Severity("no-console") != SeverityOff {
		t.Errorf("no-console: want off after later flat config override, got %v", cfg.Severity("no-console"))
	}
	if cfg.Severity("no-explicit-any") != SeverityError {
		t.Errorf("no-explicit-any: want error, got %v", cfg.Severity("no-explicit-any"))
	}
}
