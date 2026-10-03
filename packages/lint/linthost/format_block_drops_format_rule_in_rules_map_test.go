package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockDropsFormatRuleInRulesMap verifies a `format/*` rule named
// in the `rules` map is silently dropped. Formatter behavior is configured
// exclusively through the top-level `format` block, so a stray `format/*` in
// `rules` neither errors
// nor takes effect: the format block keeps driving the rule.
//
// This observes the current option winner for one conflicting semi setting,
// not a former test population or the handling of unknown ordinary rules.
//
//  1. `format: { semi: true }` expands format/semi to prefer:"always", and
//     `rules: { "format/semi": ["off", { prefer: "never" }] }` is also set.
//  2. Assert parsing succeeds and the rules entry is dropped: format/semi
//     resolves to the format block's prefer:"always", never "never".
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore preserves format.semi true as prefer always despite a conflicting rules-map format/semi off/never tuple.
// @evidence contracts/testing.md#independent-expectations Formatter settings belong exclusively to the format block; authored always and conflicting never options establish which configuration may determine the emitted payload.
// @evidence contracts/testing.md#distinguishing-cases Owns simultaneous valid format block and stray format-rule tuple, asserting the option winner without claiming check severity is enabled.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Conflicting authored format and rules-map settings reach parseExternalConfigStore, followed by independent JSON option decoding in-process; the retained semi preference is observed without formatting source or a native producer.
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
