package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiSkipsAlreadyTerminatedStatements verifies formatSemi is
// idempotent on well-terminated statements.
//
// The default statement path abstains when src[End-1] is `;`. This
// independently authored terminated declaration/call pair pins that guard;
// it does not first apply an edit or execute a second cascade pass.

// 1. Parse a source file whose every statement already ends with `;`.
// 2. Run the engine with formatSemi enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must emit no findings for an already-terminated declaration and expression call rather than inserting duplicate semicolons.
// @evidence contracts/testing.md#independent-expectations The literal source already has one terminator per statement under the default contract; zero findings is independently specified canonical behavior.
// @evidence contracts/testing.md#distinguishing-cases The unchanged declaration/call pair complements missing-terminator insertion and the fourteen-kind changed edit matrix, so idempotency does not stand alone.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiSkipsAlreadyTerminatedStatements is a selected public Go unit under the lint semantic-unit Evidence claim. The entry parses literal fixture source and directly calls Engine.Run with the owning semicolon rule, observing its findings and edits in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiSkipsAlreadyTerminatedStatements(t *testing.T) {
  file := parseTS(t, "const value = 1;\nJSON.stringify(value);\n")
  findings := NewEngine(RuleConfig{"format/semi": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d", len(findings))
  }
}
