package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorRuleReceivesAndReportsConfiguredSeverity verifies the host hands
// a contributor rule the severity it was configured with and reports its finding
// at that same severity.
//
// The contributor adapter converts the host's severity into the public
// rule.Severity before the rule runs, so a mismatch between the two orderings
// would make a warn-configured rule observe or emit error.
//
//  1. Install a contributor rule that records the severity its public Context
//     carries and reports one diagnostic on the source file node.
//  2. Run an engine configured with that rule at warn, then again at error.
//  3. Assert the rule observed the matching public severity and the collected
//     finding carries the matching host severity.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run dispatches the registered contributor rule once per run; the public Context it receives carries rule.SeverityWarn for the warn run and rule.SeverityError for the error run, and the single collected finding is a file-anchored finding of that rule at SeverityWarn or SeverityError respectively.
// @evidence contracts/testing.md#independent-expectations The expected severities are the configured literals of each run, taken from the test table rather than read back from the engine; the observed value is compared across the adapter boundary against the public constants.
// @evidence contracts/testing.md#distinguishing-cases The warn and error runs are adjacent configurations of the same rule over the same source, so a swapped or shifted severity mapping fails one of them; off is not dispatched and is covered by the engine skip tests.
// @evidence contracts/testing.md#execution-ownership Unit entry TestContributorRuleReceivesAndReportsConfiguredSeverity builds an in-process Engine over one parsed virtual source and a test-double contributor registration restored on cleanup; it starts no host, compiler program or native build.
func TestContributorRuleReceivesAndReportsConfiguredSeverity(t *testing.T) {
  const ruleName = "severity-test/contributor"
  var observed publicrule.Severity
  installProjectResultFileRuleTestDouble(t, projectResultFileRuleTestDouble{
    name: ruleName,
    check: func(ctx *publicrule.Context) {
      observed = ctx.Severity
      ctx.Report(ctx.File.AsNode(), "contributor finding")
    },
  })

  for _, run := range []struct {
    name     string
    config   Severity
    public   publicrule.Severity
    finding  Severity
  }{
    {"warn", SeverityWarn, publicrule.SeverityWarn, SeverityWarn},
    {"error", SeverityError, publicrule.SeverityError, SeverityError},
  } {
    t.Run(run.name, func(t *testing.T) {
      observed = publicrule.SeverityOff
      engine := NewEngine(RuleConfig{ruleName: run.config})
      if err := engine.ConfigError(); err != nil {
        t.Fatal(err)
      }
      findings := engine.Run([]*shimast.SourceFile{parseTS(t, "export const value = 1;\n")}, nil)
      if observed != run.public {
        t.Fatalf("contributor observed severity %v, want %v", observed, run.public)
      }
      if len(findings) != 1 || findings[0].Rule != ruleName || findings[0].File == nil ||
        findings[0].Severity != run.finding || findings[0].Message != "contributor finding" || findings[0].engineFailure {
        t.Fatalf("contributor finding = %#v, want one %v finding", findings, run.finding)
      }
    })
  }
}
