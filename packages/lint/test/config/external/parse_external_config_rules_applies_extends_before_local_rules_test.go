package main

import (
	"testing"
)

// TestParseExternalConfigRulesAppliesExtendsBeforeLocalRules verifies parse external config
// rules applies extends before local rules.
//
// External config parsing accepts ESLint-style flat config data and reduces it into the lint
// engine rule model. These tests cover file matching, ignores, extends reduction, and
// runtime-only markers before the command path loads a real project.
//
// This scenario focuses on parse external config rules applies extends before local rules. It
// protects the boundary between native fallback rules and cases that must delegate to an
// installed ESLint runtime.
//
// 1. Create the external config object or array for the branch.
// 2. Parse it through the external config reducer or store builder.
// 3. Assert resolved rules, ignored files, or runtime-required flags.
func TestParseExternalConfigRulesAppliesExtendsBeforeLocalRules(t *testing.T) {
	cfg, err := parseExternalConfigRules(map[string]any{
		"extends": []any{
			map[string]any{
				"rules": map[string]any{
					"no-var":                             "warn",
					"@typescript-eslint/no-explicit-any": "warn",
					"no-console":                         "error",
				},
			},
			[]any{
				map[string]any{
					"rules": map[string]any{
						"no-console": "off",
					},
				},
			},
		},
		"rules": map[string]any{
			"@typescript-eslint/no-explicit-any": "error",
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Severity("no-var") != SeverityWarn {
		t.Errorf("no-var: want warning from extended config, got %v", cfg.Severity("no-var"))
	}
	if cfg.Severity("no-console") != SeverityOff {
		t.Errorf("no-console: want off from later extended config, got %v", cfg.Severity("no-console"))
	}
	if cfg.Severity("no-explicit-any") != SeverityError {
		t.Errorf("no-explicit-any: want local override to error, got %v", cfg.Severity("no-explicit-any"))
	}
}
