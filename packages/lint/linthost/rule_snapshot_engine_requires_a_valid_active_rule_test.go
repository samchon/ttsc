package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRuleSnapshotEngineRequiresAValidActiveRule verifies semantic snapshot
// fixtures cannot turn missing rules or invalid options into passing silence.
//
// Negative source controls require a working configured rule. ConfigError alone
// cannot establish that premise because unknown names are a separate engine result.
//
// 1. Reject empty and misspelled names through the actual snapshot engine builder.
// 2. Reject an option payload on optionless no-var before source execution.
// 3. Accept no-var and verify its var finding and adjacent const silence.
// 4. Accept a valid option-capable arrow rule and require an observable finding.
//
// @evidence contracts/testing.md#behavioral-verification newRuleSnapshotEngine rejects empty/unknown rule identities and invalid optionless payloads, while accepted no-var produces one var error and no const finding; valid avoid-mode arrow options still produce a parentheses finding.
// @evidence contracts/testing.md#independent-expectations The snapshot contract requires a real active configured rule before interpreting silence. Authored unknown names, optionless no-var semantics, var-versus-const syntax and avoid-mode parentheses supply independent rejection and finding expectations.
// @evidence contracts/testing.md#distinguishing-cases Owns empty identity, misspelling, rejected options, successful optionless binding, acting/nonacting syntax and successful option-capable binding; intentional product config-error tests continue calling Engine directly and are not forced through this semantic snapshot helper.
// @evidence contracts/testing.md#execution-ownership This selected Go unit calls the actual snapshot builder and Engine in-process with literal options and parsed sources, without repository arrangement checks, native artifacts, consumer installation or product processes.
func TestRuleSnapshotEngineRequiresAValidActiveRule(t *testing.T) {
  for _, name := range []string{"", "test/unregistered-snapshot-rule"} {
    if engine, err := newRuleSnapshotEngine(name, nil); engine != nil || err == nil || !strings.Contains(err.Error(), "unknown snapshot rule") {
      t.Fatalf("unknown snapshot identity %q: engine=%v error=%v", name, engine, err)
    }
  }
  if engine, err := newRuleSnapshotEngine("no-var", json.RawMessage("{}")); engine != nil || err == nil || !strings.Contains(err.Error(), "no-var") || !strings.Contains(err.Error(), "does not accept options") {
    t.Fatalf("optionless payload must fail: engine=%v error=%v", engine, err)
  }
  engine, err := newRuleSnapshotEngine("no-var", nil)
  if err != nil {
    t.Fatal(err)
  }
  for _, source := range []string{"var value = 1;\n", "const value = 1;\n"} {
    file := parseTS(t, source)
    findings := engine.Run([]*shimast.SourceFile{file}, nil)
    if strings.HasPrefix(source, "var") {
      if len(findings) != 1 || findings[0].Rule != "no-var" || findings[0].Severity != SeverityError {
        t.Fatalf("accepted active no-var must report var: %+v", findings)
      }
    } else if len(findings) != 0 {
      t.Fatalf("accepted active no-var must preserve const: %+v", findings)
    }
  }
  optionEngine, err := newRuleSnapshotEngine("format/arrow-parens", json.RawMessage("{\"prefer\":\"avoid\"}"))
  if err != nil {
    t.Fatal(err)
  }
  file := parseTS(t, "const identity = (value) => value;\n")
  findings := optionEngine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 || findings[0].Rule != "format/arrow-parens" || findings[0].Severity != SeverityError {
    t.Fatalf("valid option-capable binding must report: %+v", findings)
  }
}
