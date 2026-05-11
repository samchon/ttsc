package main

import (
  "sort"
  "testing"
)

// TestRuleCodesHaveNoCollisions verifies all registered rule names produce
// distinct banner codes.
//
// The banner-rendered code (RuleCode-derived `TS9NNN` form) is the only
// runtime distinguisher a user has between two violations when reading the
// terminal output. A collision means two rules report the same code, which
// silently mis-attributes blame.
//
// `RuleCode` (compile.go:406) is currently FNV-1a 32-bit modulo 9000. The
// 6-agent review (REC-P0-6 / DIS-1) found a 60.6% birthday probability of
// at least one collision across 130 rules in 9000 buckets. This test makes
// the actual collision count an explicit fail signal so a regression
// adding a new colliding rule, or a future re-hash, cannot land silently.
//
// 1. Enumerate every rule name from `AllRuleNames`.
// 2. Hash each through `RuleCode` and group by code.
// 3. Fail with the exact collision groups when any code maps to >1 rule.
func TestRuleCodesHaveNoCollisions(t *testing.T) {
  names := AllRuleNames()
  if len(names) == 0 {
    t.Fatalf("AllRuleNames returned empty registry; expected the lint plugin to declare at least one rule")
  }

  byCode := map[int32][]string{}
  for _, name := range names {
    code := RuleCode(name)
    byCode[code] = append(byCode[code], name)
  }

  type collision struct {
    code  int32
    rules []string
  }
  var collisions []collision
  for code, rules := range byCode {
    if len(rules) <= 1 {
      continue
    }
    sort.Strings(rules)
    collisions = append(collisions, collision{code: code, rules: rules})
  }
  sort.Slice(collisions, func(i, j int) bool { return collisions[i].code < collisions[j].code })

  if len(collisions) > 0 {
    t.Errorf(
      "RuleCode produced %d collision group(s) across %d rules; this silently mis-attributes diagnostics",
      len(collisions),
      len(names),
    )
    for _, c := range collisions {
      t.Logf("  code=%d rules=%v", c.code, c.rules)
    }
  }
}
