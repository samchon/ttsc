package linthost

import (
  "testing"
)

// TestParseConfigStoreAcceptsSeverityTuples verifies that a config file's
// `rules` map accepts bare severities, `[severity]` / `[severity, options]`
// tuples, numeric severities, and scoped rule prefixes.
//
// Rule entries may be specified as bare severities or as tuples with numeric
// or string severity values. Scoped names like "@typescript-eslint/no-explicit-any"
// must strip the prefix to match the engine's plain name. A regression that
// dropped the options slot or left the prefix would produce wrong severities
// or miss the rule entirely.
//
//  1. Build an `ITtscLintConfig` object with tuple forms, numeric severity, and
//     a scoped rule name under `rules`.
//  2. Parse it through parseExternalConfigRules.
//  3. Assert all four rules resolve to the expected severity.
func TestParseConfigStoreAcceptsSeverityTuples(t *testing.T) {
  cfg, err := parseExternalConfigRules(map[string]any{
    "rules": map[string]any{
      "no-var":                              []any{"error", map[string]any{"ignore": true}},
      "no-console":                          []any{"warn"},
      "@typescript-eslint/no-explicit-any": []any{float64(2), map[string]any{"fixToUnknown": true}},
      "typescript-eslint/consistent-type-imports": "warn",
    },
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("noVar: want error, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("no-console") != SeverityWarn {
    t.Errorf("noConsole: want warning, got %v", cfg.Severity("no-console"))
  }
  if cfg.Severity("no-explicit-any") != SeverityError {
    t.Errorf("noExplicitAny: want error, got %v", cfg.Severity("no-explicit-any"))
  }
  if cfg.Severity("consistent-type-imports") != SeverityWarn {
    t.Errorf("consistentTypeImports: want warning, got %v", cfg.Severity("consistent-type-imports"))
  }
}
