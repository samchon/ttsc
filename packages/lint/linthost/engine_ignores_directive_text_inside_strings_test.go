package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineIgnoresDirectiveTextInsideStrings verifies that eslint-disable text embedded
// in a string literal is not treated as a suppression directive.
//
// The shared scanner identifies actual comment tokens before parsing directives.
// Without that lexical boundary, a string value
// like `"// eslint-disable-next-line no-var"` would suppress the next real statement.
// This pins the comment-boundary guard in the directive extractor so a refactor that
// removes the guard cannot let string content suppress actual code.
//
// 1. Parse a source file where a string literal contains a disable directive.
// 2. Run the no-var engine.
// 3. Assert the var statement on the following line is still reported.
//
// @evidence contracts/testing.md#behavioral-verification Directive-shaped bytes inside a string do not suppress the following no-var error.
// @evidence contracts/testing.md#independent-expectations The authored following var offset and canonical rule identity independently establish the report that must remain.
// @evidence contracts/testing.md#distinguishing-cases A string containing a next-line directive and an actual violation distinguish string content from genuine comment trivia.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and Engine.Run exercise the real parser and directive filter on this authored virtual source in one Go process. This individual entry observes Finding objects without installation, native compilation or a host child.
func TestEngineIgnoresDirectiveTextInsideStrings(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  source := `
    const text = "// eslint-disable-next-line no-var";
    var reported = 1;
  `
  file := parseTS(t, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 finding, got %d: %v", got, findingRules(findings))
  }
  expected := []int{strings.Index(source, "var reported")}
  for i, pos := range expected {
    finding := findings[i]
    if pos < 0 || finding.File != file || finding.Rule != "no-var" || finding.Severity != SeverityError || finding.Pos != pos {
      t.Fatalf("finding %d: want no-var error at %d, got %+v", i, pos, finding)
    }
  }
}
