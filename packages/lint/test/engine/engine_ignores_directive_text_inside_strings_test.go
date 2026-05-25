package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineIgnoresDirectiveTextInsideStrings verifies that eslint-disable text embedded
// in a string literal is not treated as a suppression directive.
//
// The directive scanner operates on the raw source text, not on the AST comment list.
// Without a check that the matched position falls inside a comment token, a string value
// like `"// eslint-disable-next-line no-var"` would suppress the next real statement.
// This pins the comment-boundary guard in the directive extractor so a refactor that
// removes the guard reactivates a real regression.
//
// 1. Parse a source file where a string literal contains a disable directive.
// 2. Run the no-var engine.
// 3. Assert the var statement on the following line is still reported.
func TestEngineIgnoresDirectiveTextInsideStrings(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  file := parseTS(t, `
    const text = "// eslint-disable-next-line no-var";
    var reported = 1;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 finding, got %d: %v", got, findingRules(findings))
  }
}
