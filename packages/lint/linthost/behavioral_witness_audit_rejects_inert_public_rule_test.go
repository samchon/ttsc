package linthost

import (
  "strings"
  "testing"
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBehavioralWitnessAuditRejectsInertPublicRule is the regression sentinel.
// It runs an actual registered no-op rule through production Engine dispatch to
// show it reports nothing, then shows the auditor rejects a public identity that
// has no recorded positive witness.
//
//  1. Register and execute a configured no-op rule on authored TypeScript.
//  2. Require zero findings and a missing-positive-witness audit rejection for that public identity.
//
// @evidence contracts/testing.md#behavioral-verification A registered no-op rule is bound at error severity by newRuleSnapshotEngine and Engine.Run over one parsed source returns zero findings; auditBehavioralWitnesses given that identity as public and an empty candidate map returns an error naming the rule and "public rules without a positive production witness". The no-op Check is not observed to run, and the engine result is not fed to the auditor: the candidate map is passed empty by the test.
// @evidence contracts/testing.md#independent-expectations The authored Check does nothing, so zero findings is the expected engine result, and a public identity with no recorded candidate must be rejected as missing a witness; the expected error fragments are literals taken from the audit contract, not from the auditor's output.
// @evidence contracts/testing.md#distinguishing-cases Successful binding in newRuleSnapshotEngine rules out an unregistered or disabled rule as the reason for silence, and the rejection is for a public rule with no witness record; valid-candidate acceptance is owned by the prerequisite-kinds and deterministic-route auditor tests. Cleanup removes this test-only registration.
// @evidence contracts/testing.md#execution-ownership Unit entry TestBehavioralWitnessAuditRejectsInertPublicRule calls Register, newRuleSnapshotEngine, Engine.Run and auditBehavioralWitnesses in the shared linthost test process on a literal source and an empty candidate map; it reads no repository file and starts no native host.
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
