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
//
// @evidence contracts/testing.md#behavioral-verification LookupRule resolves every live declaration-policy entry, while ruleVisitsDeclarationFiles accepts type-annotation no-explicit-any and rejects executable no-debugger.
// @evidence contracts/testing.md#independent-expectations Grammar meaning independently requires any annotations to be eligible in declaration files and debugger statements to be ineligible; every configured live policy name must resolve to a callable rule.
// @evidence contracts/testing.md#distinguishing-cases The full runtime policy population catches unresolved entries, and literal eligible/ineligible controls prevent an empty map from passing by vacuity. Actual declaration source dispatch is tested by the opt-in, value-rule and formatter cases.
// @evidence contracts/testing.md#execution-ownership Actual runtime registry lookup and declaration eligibility predicates execute in one Go process. This checks live callable policy rather than comparing committed files or parsing source text.
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
  typeRule := LookupRule("typescript/no-explicit-any")
  valueRule := LookupRule("no-debugger")
  if typeRule == nil || !ruleVisitsDeclarationFiles(typeRule) {
    t.Fatal("type annotation rule was not eligible for declarations")
  }
  if valueRule == nil || ruleVisitsDeclarationFiles(valueRule) {
    t.Fatal("executable debugger rule was eligible for declarations")
  }
}
