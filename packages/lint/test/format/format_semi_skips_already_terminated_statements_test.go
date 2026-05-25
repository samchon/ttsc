package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiSkipsAlreadyTerminatedStatements verifies formatSemi is
// idempotent on well-terminated statements.
//
// The rule fires only when src[End-1] is not `;`. Idempotence is non-optional
// for a formatter: any rule whose second pass re-reports its own previous
// edit would cause the fix loop to spin until the per-run cap. This scenario
// pins the negative branch directly so a future change to End-position
// semantics cannot regress to a stuttering insertion.
//
// 1. Parse a source file whose every statement already ends with `;`.
// 2. Run the engine with formatSemi enabled.
// 3. Assert zero findings.
func TestFormatSemiSkipsAlreadyTerminatedStatements(t *testing.T) {
  file := parseTS(t, "const value = 1;\nJSON.stringify(value);\n")
  findings := NewEngine(RuleConfig{"formatSemi": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d", len(findings))
  }
}
