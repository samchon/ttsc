package linthost

import (
  "testing"
)

// TestParseExternalConfigRulesAcceptsESLintFlatConfigArray verifies that an array of flat-config
// objects is reduced to a merged rule set where later entries override earlier ones.
//
// When an external config file exports an array, each element may constrain its scope via
// `files` and `ignores`. parseExternalConfigRules must flatten the array in order so that a
// second element turning "no-console" off overrides the first element's "warn". A regression
// that reversed the merge order would silently enable rules the user had overridden.
//
// 1. Build a three-element flat-config array: base rules, a file-scoped override, an ignore entry.
// 2. Parse it through parseExternalConfigRules.
// 3. Assert "no-var" stays error, "no-console" is off (overridden), and "no-explicit-any" is error.
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
