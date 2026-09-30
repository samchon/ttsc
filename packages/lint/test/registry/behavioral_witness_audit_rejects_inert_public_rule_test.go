package linthost

import (
  "strings"
  "testing"
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBehavioralWitnessAuditRejectsInertPublicRule is the regression sentinel.
// It runs an actual registered no-op rule through production Engine dispatch,
// then proves that the absence of a diagnostic leaves the synthetic public key
// uncovered.
//
//
//  1. Register and execute a configured no-op rule on authored TypeScript.
//  2. Require zero findings and a missing-positive-witness audit rejection for that public identity.
//
// @evidence contracts/testing.md#behavioral-verification A real registered no-op rule binds and executes in Engine without a diagnostic; requiring that identity in the public set then produces the missing-positive-witness error rather than registry-parity coverage.
// @evidence contracts/testing.md#independent-expectations Registration and an AST visit alone do not demonstrate a functioning diagnostic. The authored inert Check does nothing, so zero findings and a missing-positive-witness rejection are independent consequences of that fixture.
// @evidence contracts/testing.md#distinguishing-cases Successful active binding rules out an absent or disabled engine route, while the actual no-op invocation contrasts with the required positive witness. Other auditor units supply valid candidate controls; cleanup removes this test-only registration.
// @evidence contracts/testing.md#execution-ownership Direct Register, configured Engine.Run and auditBehavioralWitnesses operate in the shared Go process on literal source and an empty candidate map. This test checks actual auditor decisions, not committed test-file existence or native installation.
func TestBehavioralWitnessAuditRejectsInertPublicRule(t *testing.T) {
  inert := inertBehavioralWitnessRule{}
  Register(inert)
  t.Cleanup(func() {
    delete(registered.rules, inert.Name())
  })
  file := parseTS(t, "const value = 1;\nvoid value;\n")
  engine, err := newRuleSnapshotEngine(inert.Name(), nil)
  if err != nil { t.Fatal(err) }
  findings := engine.Run(
    []*shimast.SourceFile{file},
    nil,
  )
  if len(findings) != 0 {
    t.Fatalf("inert fixture unexpectedly diagnosed: %+v", findings)
  }
  _, err = auditBehavioralWitnesses(
    map[string]struct{}{inert.Name(): {}},
    map[string][]behavioralWitness{},
  )
  if err == nil || !strings.Contains(err.Error(), inert.Name()) || !strings.Contains(err.Error(), "public rules without a positive production witness") {
    t.Fatalf("inert public rule was not rejected: %v", err)
  }
}
