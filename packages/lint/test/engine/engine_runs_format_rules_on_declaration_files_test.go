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
func TestEngineRunsFormatRulesOnDeclarationFiles(t *testing.T) {
  file := parseTS(t, "declare const x: number")
  file.IsDeclarationFile = true
  engine := NewEngine(RuleConfig{"format/semi": SeverityError})
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("format rule did not fire on a declaration file; got %d findings", len(findings))
  }
}
