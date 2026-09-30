package linthost

import (
  "testing"
)

// TestBehavioralWitnessKindForRuleRequiresTypeAwareRule distinguishes the
// type-checker prerequisite of an actual registered rule from a syntax rule.
//
//
//  1. Resolve the live no-debugger and typescript/await-thenable registrations.
//  2. Require engine and checker classifications from their independently stated semantic prerequisites.
//
// @evidence contracts/testing.md#behavioral-verification Registered no-debugger is classified in the engine lane and registered typescript/await-thenable in the checker lane by the live rule capability predicate.
// @evidence contracts/testing.md#independent-expectations Debugger syntax needs no type information; await-thenable must resolve awaited operand types. Those semantic prerequisites determine the two literal expected kinds, not metadata derived from the returned classification.
// @evidence contracts/testing.md#distinguishing-cases Both fixture identities must actually resolve before classification. The syntax-only and type-aware controls distinguish unconditional engine or checker classification without asserting that either rule ran here.
// @evidence contracts/testing.md#execution-ownership Direct live LookupRule and behavioralWitnessKindForRule execute in-process. This unit owns prerequisite classification, while separate rule tests own diagnostics; no repository text, package layout, install or subprocess is used.
func TestBehavioralWitnessKindForRuleRequiresTypeAwareRule(t *testing.T) {
  for _, test := range []struct {
    rule string
    want behavioralWitnessKind
  }{
    {rule: "no-debugger", want: behavioralWitnessEngine},
    {rule: "typescript/await-thenable", want: behavioralWitnessChecker},
  } {
    if LookupRule(test.rule) == nil {
      t.Fatalf("regression fixture rule is not registered: %s", test.rule)
    }
    if got := behavioralWitnessKindForRule(test.rule); got != test.want {
      t.Fatalf("behavioral witness kind for %s = %s, want %s", test.rule, got, test.want)
    }
  }
}
