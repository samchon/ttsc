package linthost

import (
  "sort"
  "testing"
)

// TestDeclarationFileAllowlistNamesAreRegisteredRules verifies that every name
// in the declaration-file allowlist resolves to a registered rule.
//
// ruleVisitsDeclarationFiles looks a rule up in declarationFileRuleNames by its
// public name, so a misspelled or since-removed entry never matches and the rule
// it was meant to admit silently loses its findings on `.d.ts` sources.
//
//  1. Require a nonempty allowlist and collect its names in sorted order.
//  2. Resolve each through LookupRule.
//  3. Assert the registered rule reports exactly that name and is admitted by
//     ruleVisitsDeclarationFiles, while an unlisted value rule is not.
//
// @evidence contracts/testing.md#behavioral-verification The allowlist must be nonempty, then LookupRule and ruleVisitsDeclarationFiles run over every entry; a name that resolves to no rule, or to a rule whose own name differs, fails.
// @evidence contracts/testing.md#independent-expectations The expectation is the registry's own contract that an allowlisted name denotes a registered rule; the unlisted no-debugger control is a literal case the allowlist must not admit.
// @evidence contracts/testing.md#distinguishing-cases A nonempty listed population must resolve and be admitted, while the unlisted value rule no-debugger must be refused; removing every positive case or admitting everything cannot pass.
// @evidence contracts/testing.md#execution-ownership The test calls the engine's registry lookup and declaration-file policy directly in one Go process, with no project, Program or binary.
func TestDeclarationFileAllowlistNamesAreRegisteredRules(t *testing.T) {
  names := make([]string, 0, len(declarationFileRuleNames))
  for name := range declarationFileRuleNames {
    names = append(names, name)
  }
  if len(names) == 0 {
    t.Fatal("declaration-file allowlist must contain admitted rules")
  }
  sort.Strings(names)
  for _, name := range names {
    registered := LookupRule(name)
    if registered == nil {
      t.Errorf("allowlisted declaration-file rule %q is not a registered rule", name)
      continue
    }
    if registered.Name() != name {
      t.Errorf("rule registered for %q reports name %q", name, registered.Name())
    }
    if !ruleVisitsDeclarationFiles(registered) {
      t.Errorf("allowlisted rule %q is not admitted on declaration files", name)
    }
  }
  control := LookupRule("no-debugger")
  if control == nil || ruleVisitsDeclarationFiles(control) {
    t.Fatalf("no-debugger must be a registered rule that declaration files skip")
  }
}
