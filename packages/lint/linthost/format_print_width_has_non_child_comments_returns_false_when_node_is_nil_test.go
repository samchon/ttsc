package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatPrintWidthHasNonChildCommentsReturnsFalseWhenNodeIsNil verifies
// hasNonChildComments returns false immediately for a nil node without panicking.
//
// Locks the `if node == nil { return false }` guard at the top of
// hasNonChildComments. Without this guard, the subsequent ForEachChild call on
// a nil node would dereference a nil pointer and crash the dispatch loop.
//
//  1. Call hasNonChildComments(nil, "source", 0, 6).
//  2. Assert the return value is false and no panic occurred.
//
// @evidence contracts/testing.md#behavioral-verification hasNonChildComments must identify a real sibling-gap comment while ignoring empty/plain objects and comment-like string bytes owned by a child.
// @evidence contracts/testing.md#independent-expectations The literal block comment is trivia between property token ranges; the quoted lookalike is string content. Independent lexical meaning determines the expected booleans.
// @evidence contracts/testing.md#distinguishing-cases Nil and empty objects, ordinary adjacent members, one actual gap comment and a quoted lookalike distinguish abstention from safe child-owned bytes; this host owns the named table rows.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHasNonChildCommentsReturnsFalseWhenNodeIsNil is selected as a public Go unit by TestSelectedLintUnits; its local cases call the owning operation in the shared process without a consumer install, native artifact build or product host.
func TestFormatPrintWidthHasNonChildCommentsReturnsFalseWhenNodeIsNil(t *testing.T) {
  if got := hasNonChildComments(nil, "source", 0, 6); got {
    t.Fatalf("hasNonChildComments(nil, ...): want false, got true")
  }
  cases := []struct {
    name string
    source string
    want bool
  }{
    {"empty-object", "const x = {};\n", false},
    {"plain-members", "const x = { a: 1, b: 2 };\n", false},
    {"sibling-comment", "const x = { a: 1, /* keep */ b: 2 };\n", true},
    {"child-string", "const x = { text: \"/* not a comment */\" };\n", false},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      file := parseTS(t, tc.source)
      node := firstNodeOfKind(t, file, shimast.KindObjectLiteralExpression)
      if got := hasNonChildComments(node, tc.source, node.Pos(), node.End()); got != tc.want {
        t.Fatalf("comment ownership: want %v, got %v", tc.want, got)
      }
    })
  }
}
