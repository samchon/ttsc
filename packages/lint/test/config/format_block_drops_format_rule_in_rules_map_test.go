package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockDropsFormatRuleInRulesMap verifies a `format/*` rule named
// in the `rules` map is silently dropped, the same way an unknown rule name
// is ignored. Formatter behavior is configured exclusively through the
// top-level `format` block, so a stray `format/*` in `rules` neither errors
// nor takes effect: the format block keeps driving the rule.
//
// This replaces the former "rules-wins" override tests — the `rules` map no
// longer overrides formatter rules at all.
//
//  1. `format: { semi: true }` expands format/semi to prefer:"always", and
//     `rules: { "format/semi": ["off", { prefer: "never" }] }` is also set.
//  2. The rules entry is dropped: format/semi resolves to the format block's
//     prefer:"always", never "never", and stays enabled (not off).
func TestFormatBlockDropsFormatRuleInRulesMap(t *testing.T) {
  resolver, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{"semi": true},
    "rules": map[string]any{
      "format/semi": []any{"off", map[string]any{"prefer": "never"}},
    },
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore must not error on a format/* rules key: %v", err)
  }
  var opts struct {
    Prefer string `json:"prefer"`
  }
  if err := json.Unmarshal(resolver.RuleOptions("format/semi"), &opts); err != nil {
    t.Fatalf("decode: %v", err)
  }
  if opts.Prefer != "always" {
    t.Fatalf("rules-map format/semi must be dropped (format block wins), got prefer=%q", opts.Prefer)
  }
}
