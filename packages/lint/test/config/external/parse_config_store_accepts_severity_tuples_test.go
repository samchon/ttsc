package linthost

import (
  "testing"
)

// TestParseConfigStoreAcceptsSeverityTuples verifies that a config file's
// `rules` map accepts bare severities, `[severity]` / `[severity, options]`
// tuples, numeric severities, and the canonical `typescript/*` namespace
// alongside the optional `eslint/` prefix.
//
// `@ttsc/lint` exposes TypeScript-only rules under `typescript/*` (no
// `@typescript-eslint/*` aliases) and accepts the explicit `eslint/`
// prefix for bare ESLint-compatible rules.
//
//  1. Build a config object with tuple forms, numeric severity, the
//     `eslint/` prefix, and `typescript/*` canonical names.
//  2. Parse it through parseExternalConfigRules.
//  3. Assert each rule resolves to the expected severity.
func TestParseConfigStoreAcceptsSeverityTuples(t *testing.T) {
  cfg, err := parseExternalConfigRules(map[string]any{
    "rules": map[string]any{
      "no-var":                              []any{"error", map[string]any{"ignore": true}},
      "eslint/no-console":                   []any{"warn"},
      "typescript/no-explicit-any":          []any{float64(2), map[string]any{"fixToUnknown": true}},
      "typescript/consistent-type-imports":  "warn",
    },
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
  if cfg.Severity("typescript/no-explicit-any") != SeverityError {
    t.Errorf("typescript/no-explicit-any: want error, got %v", cfg.Severity("typescript/no-explicit-any"))
  }
  if cfg.Severity("typescript/consistent-type-imports") != SeverityWarn {
    t.Errorf("typescript/consistent-type-imports: want warning, got %v", cfg.Severity("typescript/consistent-type-imports"))
  }
}
