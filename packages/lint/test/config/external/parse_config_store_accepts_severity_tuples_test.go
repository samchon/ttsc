package linthost

import (
  "testing"
)

// TestParseExternalConfigRulesAcceptsESLintSeverityTuples verifies that [severity, options]
// tuples and scoped rule prefixes are parsed correctly from an ESLint flat config object.
//
// ESLint rules may be specified as bare severities or as [severity, options] tuples with numeric
// or string severity values. Scoped names like "@typescript-eslint/no-explicit-any" must strip
// the scope prefix to match the engine's plain name. A regression that dropped the options slot
// or left the prefix would produce wrong severities or miss the rule entirely.
//
// 1. Build a flat-config rules object with tuple forms, numeric severity, and a scoped name.
// 2. Parse it through parseExternalConfigRules.
// 3. Assert all four rules resolve to the expected severity.
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
