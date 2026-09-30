package linthost

import (
  "encoding/json"
  "testing"
)

// TestTestingLibraryWitnessKindsFollowPerRuleOptions prevents a multi-rule
// resolver from labeling unrelated findings as option-dependent.
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify two actual findings publish their own route as Options for configured test-id and Engine for unconfigured render naming; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations Only consistent-data-testid has an option entry; literal witness-kind expectations follow that per-rule ownership, independent of the recorder.
// @evidence contracts/testing.md#distinguishing-cases One resolver produces two rules and only one has options; route equality prevents unrelated previously recorded witnesses satisfying this case.
// @evidence contracts/testing.md#execution-ownership TestTestingLibraryWitnessKindsFollowPerRuleOptions owns these variants as a named Go unit entry; actual parsing/engine or registry operations execute in the shared Go process, without a DOM runtime, installed consumer or product child host.
func TestTestingLibraryWitnessKindsFollowPerRuleOptions(t *testing.T) {
  source := `
import { render } from "@testing-library/react";

function testCase() {
  const wrapper = render(<button data-testid="Bad Value">Save</button>);
  void wrapper;
}
`
  resolver := InlineRuleResolver{
    Rules: RuleConfig{
      "testing-library/consistent-data-testid":          SeverityError,
      "testing-library/render-result-naming-convention": SeverityError,
    },
    Options: RuleOptionsMap{
      "testing-library/consistent-data-testid": json.RawMessage(`{"testIdPattern":"^[a-z-]+$"}`),
    },
  }
  actual := runTestingLibraryResolver(t, source, resolver)
  expected := []ruleExpectation{
    {Rule: "testing-library/consistent-data-testid", Severity: SeverityError, Line: 5},
    {Rule: "testing-library/render-result-naming-convention", Severity: SeverityError, Line: 5},
  }
  assertTestingLibraryExpectedFindings(t, actual, expected)

  candidates := recordedBehavioralWitnesses()
  for _, test := range []struct {
    rule string
    kind behavioralWitnessKind
  }{
    {rule: "testing-library/consistent-data-testid", kind: behavioralWitnessOptions},
    {rule: "testing-library/render-result-naming-convention", kind: behavioralWitnessEngine},
  } {
    found := false
    for _, candidate := range candidates[test.rule] {
      if candidate.Route != t.Name() {
        continue
      }
      found = true
      if candidate.Kind != test.kind {
        t.Fatalf("%s witness kind = %s, want %s", test.rule, candidate.Kind, test.kind)
      }
    }
    if !found {
      t.Fatalf("%s did not publish a witness for %s", t.Name(), test.rule)
    }
  }
}
