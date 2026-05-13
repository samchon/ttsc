package main

import (
  "testing"
)

// TestParseExternalConfigRulesAcceptsESLintSeverityTuples verifies ESLint severity tuples.
//
// External config parsing accepts ESLint-style flat config data and reduces it into the lint
// engine rule model. These tests cover file matching, ignores, extends reduction, and
// runtime-only markers before the command path loads a real project.
//
// This scenario focuses on parse external config rules accepts ESLint severity tuples. It
// protects the boundary between native fallback rules and cases that must delegate to an
// installed ESLint runtime.
//
// 1. Create the external config object or array for the branch.
// 2. Parse it through the external config reducer or store builder.
// 3. Assert resolved rules, ignored files, or runtime-required flags.
func TestParseExternalConfigRulesAcceptsESLintSeverityTuples(t *testing.T) {
  cfg, err := parseExternalConfigRules(map[string]any{
    "no-var":                             []any{"error", map[string]any{"ignore": true}},
    "no-console":                         []any{"warn"},
    "@typescript-eslint/no-explicit-any": []any{float64(2), map[string]any{"fixToUnknown": true}},
    "typescript-eslint/consistent-type-imports": "warn",
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("no-console") != SeverityWarn {
    t.Errorf("no-console: want warning, got %v", cfg.Severity("no-console"))
  }
  if cfg.Severity("no-explicit-any") != SeverityError {
    t.Errorf("no-explicit-any: want error, got %v", cfg.Severity("no-explicit-any"))
  }
  if cfg.Severity("consistent-type-imports") != SeverityWarn {
    t.Errorf("consistent-type-imports: want warning, got %v", cfg.Severity("consistent-type-imports"))
  }
}
