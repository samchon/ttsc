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
//  1. Build an `ITtscLintConfig` object with `rules: { "no-var": "error" }` only.
//  2. Parse it through `parseExternalConfigStore`.
//  3. Assert no format rule is enabled.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore leaves every registered format rule disabled when only no-var/error is declared.
// @evidence contracts/testing.md#independent-expectations Formatting is opt-in through the format block; the independently authored non-format rule map must not imply any formatter policy.
// @evidence contracts/testing.md#distinguishing-cases Owns absent format with a valid ordinary rule; empty-block defaults and explicit warning severity are distinct cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry directly parses an authored no-var-only object and inspects EnabledRuleConfig in the shared lint process; no formatter source walk, fixture installation or native host is needed to observe opt-in policy.
func TestFormatBlockAbsentKeepsFormatRulesOff(t *testing.T) {
  resolver, err := parseExternalConfigStore(map[string]any{
    "rules": map[string]any{
      "no-var": "error",
    },
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  if enabled["no-var"] != SeverityError {
    t.Fatalf("ordinary rule must remain active without a format block: %v", enabled)
  }
  for name := range enabled {
    if name == "no-var" {
      continue
    }
    if isRegisteredFormatRule(name) {
      t.Errorf("expected no format rule to be enabled, found %q", name)
    }
  }
}
