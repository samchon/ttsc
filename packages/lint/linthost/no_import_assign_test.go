package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoImportAssign verifies the lint rule corpus fixture no-import-assign.ts.
//
// The annotated source mirrors packages/lint/test/testdata/corpus/no-import-assign.ts,
// which TestLintFixtureCorpus also executes. This rule uses a real temporary
// module because binding identity comes from the native checker rather than an
// AST-only name set.
//
// This case enables the rule annotation declared in no-import-assign.ts and pins
// rule identity, severity, message, and the complete assignment range. The source
// stays embedded so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture through a real Program.
// 2. Enable only no-import-assign and resolve its import alias.
// 3. Assert the native Engine reports the exact assignment range.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed findings require one exact assignment range, rule/error severity and read-only x message while an import read plus mutable local write remains clean.
// @evidence contracts/testing.md#independent-expectations Imported bindings are independently read-only; the authored x = 5 target contrasts with assigning a separately declared local initialized from x.
// @evidence contracts/testing.md#distinguishing-cases Alias import write reports; import read and subsequent local write stay clean. The imports-modules binding matrix owns shadow, namespace and TS forms.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoImportAssign is selected in the shared Go unit population. It calls runNoImportAssignProject for the original source and clean counterpart, using a real Program/Checker over fixture modules; the existing behavioral checker witness stays intact. No installed consumer, native artifact build or real product host runs.
func TestRuleCorpusNoImportAssign(t *testing.T) {
  source := "import { value as x } from \"./dep\";\n// expect: no-import-assign error\nx = 5;\n"
  findings := runNoImportAssignProject(t, source)
  if len(findings) != 1 {
    t.Fatalf("want one no-import-assign finding, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if finding.Rule != "no-import-assign" || finding.Severity != SeverityError ||
    finding.Message != "'x' is read-only." {
    t.Fatalf("unexpected finding identity: %+v", finding)
  }
  start := strings.Index(source, "x = 5")
  if finding.Pos != start || finding.End != start+len("x = 5") {
    t.Fatalf("want exact assignment range [%d,%d), got [%d,%d)",
      start, start+len("x = 5"), finding.Pos, finding.End)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessChecker)
  clean := runNoImportAssignProject(t, "import { value as x } from \"./dep\"; let local = x; local = 5;\n")
  if len(clean) != 0 {
    t.Fatalf("import read and local write: %+v", clean)
  }
}
