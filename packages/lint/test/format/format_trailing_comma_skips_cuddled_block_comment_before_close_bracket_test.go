package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaSkipsCuddledBlockCommentBeforeCloseBracket verifies
// the rule leaves the trailing comma off when a block comment sits between the
// last element and the close bracket on the SAME physical line.
//
// `node.End()` in TypeScript-Go excludes trailing trivia, so a cuddled block
// comment lives inside the leading trivia of the next token. When the comment
// shares a line with the close bracket, `last.End()..closeBracketPos` contains
// no `\n` and the rule must skip — matching prettier's `ifBreak(",")` semantics
// which key the trailing comma on group break (close bracket on its own line),
// not on internal newlines. Prettier 3.x never preserves this cuddled shape for
// short content (it reflows to one line), so the skip is the prettier-faithful
// answer on any prettier-formatted input. Pinning the cuddled branch protects
// the trivia-exclusion invariant from a future tsgo `nodePos()` semantic drift
// that would silently widen the skip beyond cuddled-bracket shapes.
//
// 1. Parse a source file with one multi-line array literal whose last element
//    is followed by a cuddled block comment and `]` on the same line.
// 2. Run the engine with format/trailing-comma enabled.
// 3. Assert zero findings.
func TestFormatTrailingCommaSkipsCuddledBlockCommentBeforeCloseBracket(t *testing.T) {
  source := "const xs = [\n  1,\n  2/* note */];\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/trailing-comma": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
}
