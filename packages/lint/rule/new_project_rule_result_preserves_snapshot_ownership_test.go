package rule_test

import (
  "reflect"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestNewProjectRuleResultPreservesSnapshotOwnership verifies finding records
// are independent snapshots while contributor state retains its exact identity.
//
// A snapshot owns its copied slice, not a deep copy of contributor state.
// Mutating the input or another snapshot must not replace its finding records;
// mutation of the shared state remains the contributor's responsibility.
//
//  1. Construct two snapshots from literal findings and one contributor state.
//  2. Mutate input and first-result records, verifying the second keeps its payload.
//  3. Mutate shared state and verify exact identity plus empty/nil snapshot controls.
//
// @evidence contracts/testing.md#behavioral-verification NewProjectRuleResult preserves supplied status and exact state, copies each finding slice independently, and returns no findings for nil or empty input. Input/result mutations cannot overwrite another snapshot's literal records.
// @evidence contracts/testing.md#independent-expectations The declared defensive-copy versus exact-state ownership contract supplies the oracle: literal error/warning messages and levels remain after unrelated slice mutations, while the authored state pointer and its changed integer are shared deliberately.
// @evidence contracts/testing.md#distinguishing-cases Two mixed-severity records detect partial copies; mutation runs from input into results and from one result into the other. Nil/empty findings and nil state are adjacent absence controls. Live reporter closure belongs to host lifecycle units and is not claimed by this constructor-only case.
// @evidence contracts/testing.md#execution-ownership This external-package direct unit calls the public constructor without a host reporter or registry fixture. It owns slice and state transfer only, with no Program, filesystem, installed consumer or subprocess.
func TestNewProjectRuleResultPreservesSnapshotOwnership(t *testing.T) {
  state := &struct{ value int }{value: 7}
  input := []rule.ProjectFinding{
    {Message: "first problem", Severity: rule.SeverityError},
    {Message: "second warning", Severity: rule.SeverityWarn},
  }
  first := rule.NewProjectRuleResult(rule.ProjectRuleFailed, state, input, nil)
  second := rule.NewProjectRuleResult(rule.ProjectRulePassed, state, input, nil)
  want := []rule.ProjectFinding{
    {Message: "first problem", Severity: rule.SeverityError},
    {Message: "second warning", Severity: rule.SeverityWarn},
  }
  input[0] = rule.ProjectFinding{Message: "input mutation", Severity: rule.SeverityOff}
  input[1].Message = "other input mutation"
  if first.Status != rule.ProjectRuleFailed || second.Status != rule.ProjectRulePassed || first.State != state || second.State != state {
    t.Fatalf("snapshot changed supplied status or state identity: first=%#v second=%#v", first, second)
  }
  if !reflect.DeepEqual(first.Findings, want) || !reflect.DeepEqual(second.Findings, want) {
    t.Fatalf("input mutation overwrote copied findings: first=%#v second=%#v", first.Findings, second.Findings)
  }
  first.Findings[0].Message = "first snapshot mutation"
  first.Findings[1].Severity = rule.SeverityOff
  if !reflect.DeepEqual(second.Findings, want) {
    t.Fatalf("snapshots share mutable finding records: %#v", second.Findings)
  }
  if input[0].Message != "input mutation" || input[1].Message != "other input mutation" || input[1].Severity != rule.SeverityWarn {
    t.Fatalf("snapshot mutation overwrote input storage: %#v", input)
  }
  state.value = 9
  if first.State != state || second.State != state || first.State.(*struct{ value int }).value != 9 || second.State.(*struct{ value int }).value != 9 {
    t.Fatalf("snapshot deep-copied contributor-owned state: first=%#v second=%#v", first.State, second.State)
  }
  for _, absent := range [][]rule.ProjectFinding{nil, {}} {
    result := rule.NewProjectRuleResult(rule.ProjectRuleNotEvaluated, nil, absent, nil)
    if result.Status != rule.ProjectRuleNotEvaluated || result.State != nil || len(result.Findings) != 0 {
      t.Fatalf("empty snapshot fabricated state or findings: %#v", result)
    }
  }
}
