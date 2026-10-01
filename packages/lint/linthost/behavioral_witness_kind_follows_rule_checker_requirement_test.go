package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type witnessKindSentinelRule struct {
  name string
  // checker is nil for a rule that never declares the capability.
  checker *bool
}

func (r witnessKindSentinelRule) Name() string                  { return r.name }
func (r witnessKindSentinelRule) Visits() []shimast.Kind        { return nil }
func (r witnessKindSentinelRule) Check(*Context, *shimast.Node) {}

type witnessKindTypedSentinelRule struct {
  witnessKindSentinelRule
}

func (r witnessKindTypedSentinelRule) NeedsTypeChecker() bool { return *r.checker }

// TestBehavioralWitnessKindFollowsRuleCheckerRequirement verifies a rule's
// witness prerequisite kind is the checker lane exactly when the registered rule
// declares that it needs the type checker.
//
// Three sentinel rules cover the three shapes the classifier can meet: no
// capability at all, a capability answering false, and a capability answering
// true. Their expected kinds are fixed by that declaration, not by the
// classifier's output.
//
//  1. Register an undeclared rule, a rule declaring NeedsTypeChecker false and a
//     rule declaring it true.
//  2. Classify each registered name.
//  3. Require engine, engine and checker respectively.
//
// @evidence contracts/testing.md#behavioral-verification behavioralWitnessKindForRule is called on three registered sentinel names and returns the engine kind for a rule with no type-aware marker and for one whose marker answers false, and the checker kind for the one whose marker answers true.
// @evidence contracts/testing.md#independent-expectations The expected kinds follow from what each sentinel declares (no marker, marker false, marker true) rather than from the classifier's own lookup, and no production rule name is asserted to be registered or to need a checker.
// @evidence contracts/testing.md#distinguishing-cases The absent marker and the false marker are separate negatives next to the true marker, so a classifier that treats mere interface presence as checker demand, or that always answers one kind, fails one of the three rows.
// @evidence contracts/testing.md#execution-ownership Unit entry TestBehavioralWitnessKindFollowsRuleCheckerRequirement registers private stubs through Register in the shared linthost test process and removes them on cleanup; it runs no rule, starts no checker and reads no repository file.
func TestBehavioralWitnessKindFollowsRuleCheckerRequirement(t *testing.T) {
  yes, no := true, false
  rows := []struct {
    rule Rule
    want behavioralWitnessKind
  }{
    {witnessKindSentinelRule{name: "test/witness-kind-undeclared"}, behavioralWitnessEngine},
    {witnessKindTypedSentinelRule{witnessKindSentinelRule{name: "test/witness-kind-declines", checker: &no}}, behavioralWitnessEngine},
    {witnessKindTypedSentinelRule{witnessKindSentinelRule{name: "test/witness-kind-requires", checker: &yes}}, behavioralWitnessChecker},
  }
  for _, row := range rows {
    name := row.rule.Name()
    if LookupRule(name) != nil {
      t.Fatalf("sentinel name %q is already registered", name)
    }
    Register(row.rule)
    t.Cleanup(func() {
      delete(registered.rules, name)
      invalidateRuntimeRuleCodes()
    })
  }
  for _, row := range rows {
    if got := behavioralWitnessKindForRule(row.rule.Name()); got != row.want {
      t.Fatalf("behavioral witness kind for %s = %s, want %s", row.rule.Name(), got, row.want)
    }
  }
}
