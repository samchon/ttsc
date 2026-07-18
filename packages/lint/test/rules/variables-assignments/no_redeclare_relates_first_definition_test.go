package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoRedeclareRelatesFirstDefinition verifies the built-in no-redeclare rule
// attaches a related location pointing at the first declaration, so an editor can
// lead the reader from "'x' is already defined." to where the binding first came
// from. The rule already captured the prior declaration's node to build its
// scope map; this pins that the node reaches the finding as a related location
// rather than being discarded.
//
//  1. Lint a source that declares `sample` twice in one scope.
//  2. Assert the redeclaration finding carries exactly one related location whose
//     message names the first definition and whose range precedes the finding.
func TestNoRedeclareRelatesFirstDefinition(t *testing.T) {
  file := parseTS(t, "var sample = 1;\nvar sample = 2;\nvoid sample;\n")
  findings := NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"no-redeclare": SeverityError},
  }).Run([]*shimast.SourceFile{file}, nil)

  var redeclare *Finding
  for _, f := range findings {
    if f.Rule == "no-redeclare" {
      redeclare = f
      break
    }
  }
  if redeclare == nil {
    t.Fatalf("no-redeclare produced no finding; got %d findings", len(findings))
  }
  if len(redeclare.RelatedInformation) != 1 {
    t.Fatalf("want one related location, got %v", redeclare.RelatedInformation)
  }
  related := redeclare.RelatedInformation[0]
  if !strings.Contains(related.Message, "first defined") {
    t.Fatalf("related message should name the first definition, got %q", related.Message)
  }
  if related.End > redeclare.Pos {
    t.Fatalf("the first definition (end %d) should precede the redeclaration (pos %d)", related.End, redeclare.Pos)
  }
}
