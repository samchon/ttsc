package linthost

import "testing"

// TestFormatBlockAbsentKeepsFormatRulesOff verifies the opt-in
// contract: with no `format` block and no `format/*` entries in
// `rules`, every format rule stays off.
//
// This is the round-trip safety net for users who don't want
// formatting today. A regression that enabled format defaults
// without an explicit block would silently rewrite source on
// `ttsc format` for every existing project.
//
//  1. Build an `ITtscLintConfig` object with `rules: { "noVar": "error" }` only.
//  2. Parse it through `parseExternalConfigStore`.
//  3. Assert no format rule is enabled.
func TestFormatBlockAbsentKeepsFormatRulesOff(t *testing.T) {
  resolver, err := parseExternalConfigStore(map[string]any{
    "rules": map[string]any{
      "noVar": "error",
    },
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  for name := range enabled {
    if name == "noVar" {
      continue
    }
    if isRegisteredFormatRule(name) {
      t.Errorf("expected no format rule to be enabled, found %q", name)
    }
  }
}
