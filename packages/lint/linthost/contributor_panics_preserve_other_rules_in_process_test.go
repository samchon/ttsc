package linthost

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorPanicsPreserveOtherRulesInProcess verifies the original public
// contributor panic fixture continues through healthy and built-in checks.
//
// The sole cold TestMain bootstrap owns the exact metadata boom rejection warning.
// This entry owns Check panic recovery, public Report transport and builtin no-var
// over the unchanged var/void source, without compiling a contributor host.
//
// 1. Load the original source with the in-process Program checker.
// 2. Enable the original Check-panicking, healthy and builtin rule identities.
// 3. Require exactly three error findings and the authored callback messages.
// 4. Disable only the bomb and require the other two findings to remain.
//
// @evidence contracts/testing.md#behavioral-verification The cold bootstrap rejects Name's metadata boom; Engine recovers check boom as an error while the public healthy contributor reports healthy contributor ran and builtin no-var reports on the original var/void source.
// @evidence contracts/testing.md#independent-expectations Authored callbacks supply the literal panic and healthy messages; no-var rejects the original var declaration. Exactly three named errors, and two when the bomb is off, detect abortion or silent suppression.
// @evidence contracts/testing.md#distinguishing-cases Owns rejected public metadata followed by two public adapters and a builtin, actual panic versus disabled-panic control, and surviving public report transport. TestMain checks the cold warning and absence of a raw metadata panic stack; quarantine units own repeated nodes and later files.
// @evidence contracts/testing.md#execution-ownership This selected Go unit uses one in-process loadProgram checker and the immutable public registrations published by the sole cold TestMain bootstrap, without consumer installation, native compilation or a product process. Native static init/link startup remains a shared contributor boundary.
func TestContributorPanicsPreserveOtherRulesInProcess(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), "{\"compilerOptions\":{\"target\":\"ES2022\",\"module\":\"commonjs\",\"strict\":true,\"noEmit\":true},\"files\":[\"src/main.ts\"]}")
  writeFile(t, filepath.Join(root, "src", "main.ts"), "var legacy = 1;\nvoid legacy;\n")
  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{needsRuleChecker: true})
  if err != nil || len(diags) != 0 {
    t.Fatalf("original contributor source Program: diagnostics=%v error=%v", diags, err)
  }
  defer prog.close()
  if prog.checker == nil {
    t.Fatal("unmarked public contributors require a real checker")
  }
  for _, bombSeverity := range []Severity{SeverityError, SeverityOff} {
    engine := NewEngine(RuleConfig{
      "broken/check-panic": bombSeverity,
      "broken/healthy":     SeverityError,
      "no-var":             SeverityError,
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("contributor binding: %v", err)
    }
    findings := engine.Run(prog.userSourceFiles(), prog.checker)
    wantCount := 3
    if bombSeverity == SeverityOff {
      wantCount = 2
    }
    if len(findings) != wantCount {
      t.Fatalf("bomb severity %v findings=%+v, want %d", bombSeverity, findings, wantCount)
    }
    seen := map[string]*Finding{}
    for _, finding := range findings {
      if finding.Severity != SeverityError {
        t.Fatalf("original fixture must report error: %+v", finding)
      }
      if seen[finding.Rule] != nil {
        t.Fatalf("duplicate finding for %s", finding.Rule)
      }
      seen[finding.Rule] = finding
    }
    if seen["broken/healthy"] == nil || seen["broken/healthy"].Message != "healthy contributor ran" || seen["no-var"] == nil {
      t.Fatalf("healthy contributor and builtin must survive: %+v", findings)
    }
    if bombSeverity == SeverityError {
      if seen["broken/check-panic"] == nil || !strings.Contains(seen["broken/check-panic"].Message, "panicked") || !strings.Contains(seen["broken/check-panic"].Message, "check boom") {
        t.Fatalf("original Check panic must be recovered visibly: %+v", findings)
      }
    } else if seen["broken/check-panic"] != nil {
      t.Fatalf("disabled bomb must not report: %+v", findings)
    }
  }
}

// The original three public callbacks join the existing single cold bootstrap.
func init() {
  publicrule.Register(originalMetadataPanicContributor{})
  publicrule.Register(originalCheckPanicContributor{})
  publicrule.Register(originalHealthyContributor{})
}

type originalMetadataPanicContributor struct{}

func (originalMetadataPanicContributor) Name() string { panic("metadata boom") }
func (originalMetadataPanicContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableStatement}
}
func (originalMetadataPanicContributor) Check(*publicrule.Context, *shimast.Node) {}

type originalCheckPanicContributor struct{}

func (originalCheckPanicContributor) Name() string { return "broken/check-panic" }
func (originalCheckPanicContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableStatement}
}
func (originalCheckPanicContributor) Check(*publicrule.Context, *shimast.Node) { panic("check boom") }

type originalHealthyContributor struct{}

func (originalHealthyContributor) Name() string { return "broken/healthy" }
func (originalHealthyContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableStatement}
}
func (originalHealthyContributor) Check(ctx *publicrule.Context, node *shimast.Node) {
  ctx.Report(node, "healthy contributor ran")
}
