package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaSkipsCallWithHuggingCloseBrackets verifies the rule
// leaves the trailing comma off when a multi-line argument hugs the call's
// closing `)` on the same line.
//
// Prettier's `trailingComma: "all"` keys the comma on whether the close bracket
// lands on its own line, not on whether the list contains a newline somewhere.
// `JSON.stringify({\n  ...\n})` is the canonical hug-the-last-argument output
// from prettier's `couldExpandArg`/`shouldExpandLastArg` printer paths, where
// `}` and `)` collapse onto one line. An earlier version of this rule fired
// on this shape and emitted the syntactically valid but stylistically wrong
// `},)`; the fix narrowed the multi-line check to `last.End()..closeBracketPos`.
// Pinning the hug branch at the Go-unit layer keeps a future refactor that
// widens the boundary back to `list.Pos()..closeBracketPos` from regressing
// silently — the slow e2e fixture would catch it, but only after a full
// launcher spawn.
//
// 1. Parse a source file with one multi-line call whose sole argument is a
//    multi-line object literal hugged by the call's `)`.
// 2. Run the engine with format/trailing-comma enabled.
// 3. Assert zero findings — neither the call nor the already-terminated
//    object literal contribute an edit.
func TestFormatTrailingCommaSkipsCallWithHuggingCloseBrackets(t *testing.T) {
  source := "JSON.stringify({\n  a: 1,\n  b: 2,\n});\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/trailing-comma": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
}
