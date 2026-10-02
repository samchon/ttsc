package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentIgnoresDirectiveTextInsideStringsAndTemplates verifies
// only real comment tokens are classified, and offsets survive templates.
//
// A naive substring scan would flag directive text inside string and
// template literals. The shared comment enumerator excludes parser-owned
// string and template tokens, then scans only the remaining source gaps.
// Literal contents stay silent while the real comment after an object-bearing
// template substitution reports at its exact byte offset.
//
//  1. Assert directive strings inside a string and a template produce
//     zero findings.
//  2. Lint a template whose substitution contains `}` followed by a real
//     `// @ts-ignore` comment.
//  3. Assert the single finding starts at the comment's offset.
//
// @evidence contracts/testing.md#behavioral-verification Directive-shaped text in literals stays clean while a real comment after a template reports at its exact offset.
// @evidence contracts/testing.md#independent-expectations Strings/templates do not contain actual suppression comments; the authored second source has one real ignore substring outside its template.
// @evidence contracts/testing.md#distinguishing-cases Both a zero string/template fixture and a positive post-template comment preserve scanner state distinctions.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource owns the literal-text case; parseTS/NewEngine.Run owns the second source and exact range, both under this Test. No consumer install or native product-host build/launch is used.
func TestBanTsCommentIgnoresDirectiveTextInsideStringsAndTemplates(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  assertRuleSkipsSource(
    t,
    ruleName,
    "const s = \"// @ts-ignore\";\nconst u = `${s} // @ts-nocheck`;\nJSON.stringify([s, u]);\n",
  )

  source := "const v = `a${JSON.stringify({ b: 1 })}c`;\n// @ts-ignore\nconst w: number = 1;\nJSON.stringify([v, w]);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  offset := strings.Index(source, "// @ts-ignore")
  if findings[0].Pos != offset || findings[0].End != offset+len("// @ts-ignore") {
    t.Fatalf("want range [%d,%d), got [%d,%d)",
      offset, offset+len("// @ts-ignore"), findings[0].Pos, findings[0].End)
  }
}
