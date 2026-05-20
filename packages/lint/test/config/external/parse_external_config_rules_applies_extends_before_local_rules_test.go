package linthost

import (
  "testing"
)

// TestParseExternalConfigRulesAppliesExtendsBeforeLocalRules verifies that the `extends` array
// is fully reduced first and then local `rules` can override individual entries.
//
// The precedence rule is: extends entries provide the base, local rules win. A regression that
// applied extends after local rules would silently undo per-project overrides. This also pins
// nested flat-config arrays inside extends, which must be recursively flattened before merging.
//
// 1. Build a config object whose `extends` array contains both an object and a flat-config array.
// 2. Parse it through parseExternalConfigRules with a local `rules` override.
// 3. Assert the local override wins and the extends-only rule is preserved at its extends severity.
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
