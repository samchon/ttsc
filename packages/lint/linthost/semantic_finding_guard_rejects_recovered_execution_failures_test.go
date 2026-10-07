package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type semanticFindingGuardPanickingRule struct{}

func (semanticFindingGuardPanickingRule) Name() string { return "test/semantic-finding-guard-panic" }
func (semanticFindingGuardPanickingRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (semanticFindingGuardPanickingRule) Check(*Context, *shimast.Node) {
  panic("semantic guard panic")
}

// TestSemanticFindingGuardRejectsRecoveredExecutionFailures protects semantic
// corpus and snapshot harnesses from blessing recovered failures as findings.
// An engine failure retains the configured rule name, severity and source line;
// normalization of those fields must not establish successful rule execution.
//
// @evidence contracts/testing.md#behavioral-verification A real registered panicking rule produces a recovered engine finding that the semantic guard rejects, while an ordinary no-var finding and a directly supplied empty finding set are accepted. Corrupting the ordinary finding's identity or severity and supplying nil are also rejected.
// @evidence contracts/testing.md#independent-expectations A failed invocation is not a positive semantic diagnostic even when its name and severity match the configured rule. The authored panic and ordinary var source independently distinguish recovery from a successful no-var report; literal rejection classes specify the guard's failure surface.
// @evidence contracts/testing.md#distinguishing-cases Same-name error-severity recovery contrasts with an ordinary error, unknown identity, warn instead of configured error, disabled severity and nil. A directly supplied nil finding slice is accepted; this cell tests empty-set admission without proving that a rule invocation produced it.
// @evidence contracts/testing.md#execution-ownership Real Register, Engine.Run and the shared semantic guard execute directly in the Go process. Mutations copy the actual ordinary finding before changing one field; no native compilation, installation, source-layout assertion or subprocess is used.
func TestSemanticFindingGuardRejectsRecoveredExecutionFailures(t *testing.T) {
  panicRule := semanticFindingGuardPanickingRule{}
  Register(panicRule)
  t.Cleanup(func() { delete(registered.rules, panicRule.Name()) })
  panicEngine, err := newRuleSnapshotEngine(panicRule.Name(), nil)
  if err != nil {
    t.Fatal(err)
  }
  panicFindings := panicEngine.Run([]*shimast.SourceFile{parseTS(t, "var value = 1;\n")}, nil)
  if len(panicFindings) != 1 || !panicFindings[0].engineFailure || panicFindings[0].Rule != panicRule.Name() || panicFindings[0].Severity != SeverityError {
    t.Fatalf("real recovery did not produce the configured failure: %+v", panicFindings)
  }
  if err := validateSemanticRuleFindings(RuleConfig{panicRule.Name(): SeverityError}, panicFindings); err == nil || !strings.Contains(err.Error(), "execution failed: ") || !strings.Contains(err.Error(), "semantic guard panic") {
    t.Fatalf("recovered failure was not rejected: %v", err)
  }
  rules := RuleConfig{"no-var": SeverityError}
  engine, err := newRuleSnapshotEngine("no-var", nil)
  if err != nil {
    t.Fatal(err)
  }
  findings := engine.Run([]*shimast.SourceFile{parseTS(t, "var value = 1;\n")}, nil)
  if len(findings) != 1 || findings[0].Rule != "no-var" || findings[0].Severity != SeverityError || findings[0].engineFailure {
    t.Fatalf("ordinary positive control failed: %+v", findings)
  }
  if err := validateSemanticRuleFindings(rules, findings); err != nil {
    t.Fatalf("ordinary finding rejected: %v", err)
  }
  if err := validateSemanticRuleFindings(rules, nil); err != nil {
    t.Fatalf("empty successful findings rejected: %v", err)
  }
  for _, mutate := range []func(*Finding){
    func(f *Finding) { f.Rule = "test/unconfigured-semantic-rule" },
    func(f *Finding) { f.Severity = SeverityWarn },
  } {
    invalid := *findings[0]
    mutate(&invalid)
    if err := validateSemanticRuleFindings(rules, []*Finding{&invalid}); err == nil || !strings.Contains(err.Error(), "unexpected rule/severity") {
      t.Fatalf("invalid ordinary finding accepted: %v", err)
    }
  }
  if err := validateSemanticRuleFindings(RuleConfig{"no-var": SeverityOff}, findings); err == nil {
    t.Fatal("disabled rule finding accepted")
  }
  if err := validateSemanticRuleFindings(rules, []*Finding{nil}); err == nil || !strings.Contains(err.Error(), "is nil") {
    t.Fatalf("nil finding accepted: %v", err)
  }
}
