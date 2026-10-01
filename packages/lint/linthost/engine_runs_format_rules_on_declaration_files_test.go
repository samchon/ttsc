package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineRunsFormatRulesOnDeclarationFiles verifies format rules keep
// firing on declaration-file sources.
//
// The declaration-file skip (issue #177) must not change `ttsc format` /
// `ttsc fix` behavior: hand-written `.d.ts` files are formatted on the same
// boundary as any other source, so the engine treats every FormatRule as
// declaration-visiting without requiring a per-rule marker.
//
//  1. Parse `declare const x: number` (missing statement terminator).
//  2. Mark it as a declaration source file.
//  3. Run the engine with `format/semi` and assert the missing-semicolon
//     finding is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run retains the format/semi error on a marked declaration missing its statement terminator.
// @evidence contracts/testing.md#independent-expectations The authored declare const x:number source lacks the required semicolon, independently requiring the canonical formatter diagnostic at configured error severity.
// @evidence contracts/testing.md#distinguishing-cases An admitted FormatRule contrasts the curated type-rule admission and executable-rule rejection tests; this case observes a finding rather than applying a file rewrite.
// @evidence contracts/testing.md#execution-ownership The real parser and direct format/semi engine run in the shared Go process on one virtual declaration source without CLI formatting, native compilation or installation.
func TestEngineRunsFormatRulesOnDeclarationFiles(t *testing.T) {
  file := parseTS(t, "declare const x: number")
  file.IsDeclarationFile = true
  engine := NewEngine(RuleConfig{"format/semi": SeverityError})
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("format rule did not fire on a declaration file; got %d findings", len(findings))
  }
  if finding := findings[0]; finding.File != file || finding.Rule != "format/semi" || finding.Severity != SeverityError {
    t.Fatalf("declaration formatter diagnostic changed: %+v", finding)
  }
}
