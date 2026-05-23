package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDirectiveAfterTemplateExpression verifies that `eslint-disable-next-line`
// continues to suppress findings on lines that follow a template literal containing a
// `${...}` substitution earlier in the file.
//
// The directive scanner drives a raw `shimscanner.Scanner` over the whole file; the
// raw scanner does not split a `KindTemplateExpression` head/middle/tail by itself,
// so its reported `TokenStart`/`TokenEnd` for any later comment can drift relative
// to the underlying source bytes. When that happens, `GetECMALineOfPosition` lands
// on the wrong line and the disable-next-line directive silently stops suppressing.
//
//  1. Declare a template literal with one `${...}` substitution.
//  2. Place an `eslint-disable-next-line eqeqeq` directive before a `==` comparison.
//  3. Run the eqeqeq engine and assert the comparison is suppressed.
func TestEngineDirectiveAfterTemplateExpression(t *testing.T) {
  engine := NewEngine(RuleConfig{"eqeqeq": SeverityError})
  file := parseTS(t, "const t = `foo${1}bar`;\n// eslint-disable-next-line eqeqeq\nif (1 == 1) {}\n")
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 0 {
    t.Fatalf("want 0 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}
