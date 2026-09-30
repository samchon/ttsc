package linthost

import (
  "strings"
  "testing"
)

// TestBehavioralWitnessAuditRejectsInvalidNonCanonicalCandidate checks every
// candidate, including one that would lose canonical lexical selection.
//
//
//  1. Accept the authored valid Alpha record alone.
//  2. Add later records with wrong identity, empty route, unsupported kind or invalid source addresses and require rejection.
//
// @evidence contracts/testing.md#behavioral-verification A later candidate naming another rule is rejected even alongside a valid canonical Alpha record. Empty routes, unsupported kinds and invalid source-address shapes likewise fail; the valid canonical candidate alone is accepted.
// @evidence contracts/testing.md#independent-expectations Each record must name its public rule, supply a route, use a supported prerequisite and identify exactly one test basename. These independent record constraints apply to all candidates, not just the lexical winner.
// @evidence contracts/testing.md#distinguishing-cases The original noncanonical wrong-rule candidate remains; independent empty-route, invalid-kind, zero/two source, non-test source and non-basename source mutations isolate the remaining validation branches against a valid Alpha control.
// @evidence contracts/testing.md#execution-ownership The auditor validates authored records directly in-process; filename strings exercise address grammar rather than repository existence or source-content comparisons. No production finding or native host is claimed by these synthetic decision inputs.
func TestBehavioralWitnessAuditRejectsInvalidNonCanonicalCandidate(t *testing.T) {
  public := map[string]struct{}{"fixture/rule": {}}
  candidates := map[string][]behavioralWitness{
    "fixture/rule": {
      {Rule: "fixture/rule", Route: "TestAlpha", Kind: behavioralWitnessEngine, Sources: []string{"alpha_test.go"}},
      {Rule: "fixture/other", Route: "TestZulu", Kind: behavioralWitnessEngine, Sources: []string{"zulu_test.go"}},
    },
  }
  _, err := auditBehavioralWitnesses(public, candidates)
  if err == nil || !strings.Contains(err.Error(), "fixture/other") {
    t.Fatalf("invalid non-canonical candidate was not rejected: %v", err)
  }
  valid := candidates["fixture/rule"][0]
  if _, err := auditBehavioralWitnesses(public, map[string][]behavioralWitness{"fixture/rule": {valid}}); err != nil { t.Fatalf("valid canonical candidate rejected: %v", err) }
  for _, mutate := range []func(*behavioralWitness){
    func(w *behavioralWitness) { w.Route = "" },
    func(w *behavioralWitness) { w.Kind = "unsupported" },
    func(w *behavioralWitness) { w.Sources = nil },
    func(w *behavioralWitness) { w.Sources = []string{"alpha_test.go", "zulu_test.go"} },
    func(w *behavioralWitness) { w.Sources = []string{"alpha.go"} },
    func(w *behavioralWitness) { w.Sources = []string{"nested/alpha_test.go"} },
  } {
    invalid := valid
    invalid.Route = "TestZulu"
    mutate(&invalid)
    if _, err := auditBehavioralWitnesses(public, map[string][]behavioralWitness{"fixture/rule": {valid, invalid}}); err == nil || !strings.Contains(err.Error(), "invalid witness records") { t.Fatalf("invalid candidate accepted: %+v %v", invalid, err) }
  }
}
