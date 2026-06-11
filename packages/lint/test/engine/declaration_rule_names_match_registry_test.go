package linthost

import (
  "testing"
)

// TestDeclarationRuleNamesMatchRegistry verifies every entry in the
// declaration-file allowlist names a registered built-in rule.
//
// The allowlist in `declaration_rules.go` is a hand-curated map keyed by
// rule name. A typo or a rename that misses the map would silently turn a
// declaration-visiting rule into a skipped one — no error, just lost
// findings on `.d.ts` inputs — so the registry parity is pinned the same
// way the typed-key config surface is.
//
// 1. Iterate `declarationFileRuleNames`.
// 2. Look each name up in the global rule registry.
// 3. Fail listing every name that does not resolve to a registered rule.
func TestDeclarationRuleNamesMatchRegistry(t *testing.T) {
  var missing []string
  for name := range declarationFileRuleNames {
    if LookupRule(name) == nil {
      missing = append(missing, name)
    }
  }
  if len(missing) != 0 {
    t.Fatalf("declarationFileRuleNames entries missing from the registry: %v", missing)
  }
}
