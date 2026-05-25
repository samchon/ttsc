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
      "noVar":                              []any{"error", map[string]any{"ignore": true}},
      "noConsole":                          []any{"warn"},
      "@typescript-eslint/no-explicit-any": []any{float64(2), map[string]any{"fixToUnknown": true}},
      "typescript-eslint/consistent-type-imports": "warn",
    },
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("noVar") != SeverityError {
    t.Errorf("noVar: want error, got %v", cfg.Severity("noVar"))
  }
  if cfg.Severity("noConsole") != SeverityWarn {
    t.Errorf("noConsole: want warning, got %v", cfg.Severity("noConsole"))
  }
  if cfg.Severity("noExplicitAny") != SeverityError {
    t.Errorf("noExplicitAny: want error, got %v", cfg.Severity("noExplicitAny"))
  }
  if cfg.Severity("consistentTypeImports") != SeverityWarn {
    t.Errorf("consistentTypeImports: want warning, got %v", cfg.Severity("consistentTypeImports"))
  }
}
