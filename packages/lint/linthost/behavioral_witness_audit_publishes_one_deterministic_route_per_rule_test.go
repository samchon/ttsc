package linthost

import (
  "reflect"
  "testing"
)

// TestBehavioralWitnessAuditPublishesOneDeterministicRoutePerRule preserves the
// chosen record as well as its route under candidate input permutations.
//
//  1. Submit distinct Alpha and Zulu records for one public identity in both orders.
//  2. Require the complete literal Alpha record and unchanged caller input after canonical selection.
//
// @evidence contracts/testing.md#behavioral-verification Two valid candidates for one public identity yield exactly the complete TestAlpha engine record regardless of candidate input order, while the caller's candidate slice is unchanged.
// @evidence contracts/testing.md#independent-expectations Lexical route ordering makes TestAlpha precede TestZulu. The literal Alpha record defines Rule, Route, Kind and Sources independently of the auditor's result rather than comparing only two generated routes.
// @evidence contracts/testing.md#distinguishing-cases Reversed input order must not change the canonical record; differing engine/project kinds and alpha/zulu sources expose accidental field mixing. Preserving the input order checks caller ownership.
// @evidence contracts/testing.md#execution-ownership Direct auditor calls consume two authored candidate records in the Go process, without reading files or invoking production rule hosts. This test owns deterministic canonicalization, not the validity of actual production findings.
func TestBehavioralWitnessAuditPublishesOneDeterministicRoutePerRule(t *testing.T) {
  public := map[string]struct{}{"fixture/rule": {}}
  candidates := map[string][]behavioralWitness{
    "fixture/rule": {
      {Rule: "fixture/rule", Route: "TestZulu", Kind: behavioralWitnessProject, Sources: []string{"zulu_test.go"}},
      {Rule: "fixture/rule", Route: "TestAlpha", Kind: behavioralWitnessEngine, Sources: []string{"alpha_test.go"}},
    },
  }
  canonical, err := auditBehavioralWitnesses(public, candidates)
  if err != nil {
    t.Fatalf("audit failed: %v", err)
  }
  if len(canonical) != 1 || canonical["fixture/rule"].Route != "TestAlpha" {
    t.Fatalf("canonical route was not deterministic: %+v", canonical)
  }
  want := behavioralWitness{Rule: "fixture/rule", Route: "TestAlpha", Kind: behavioralWitnessEngine, Sources: []string{"alpha_test.go"}}
  if !reflect.DeepEqual(canonical["fixture/rule"], want) { t.Fatalf("canonical record: got %+v, want %+v", canonical, want) }
  if candidates["fixture/rule"][0].Route != "TestZulu" { t.Fatalf("caller candidate order changed: %+v", candidates) }
  candidates["fixture/rule"][0], candidates["fixture/rule"][1] = candidates["fixture/rule"][1], candidates["fixture/rule"][0]
  reversed, err := auditBehavioralWitnesses(public, candidates)
  if err != nil || len(reversed) != 1 || !reflect.DeepEqual(reversed["fixture/rule"], want) { t.Fatalf("reversed candidates: %+v %v", reversed, err) }
}
