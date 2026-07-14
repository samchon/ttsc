package linthost

import (
  "encoding/json"
  "testing"
)

// TestTestingLibraryWitnessKindsFollowPerRuleOptions prevents a multi-rule
// resolver from labeling unrelated findings as option-dependent.
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
