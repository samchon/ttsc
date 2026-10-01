package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentFollowsRegexInNestedTemplate verifies a real directive after
// nested template substitutions remains visible when a regex contains braces.
//
// The parser assigns the regular-expression lexical goal, so braces and an
// escaped slash inside the literal cannot alter template-substitution state in
// the shared comment enumerator. A context-free scanner used to lose the real
// trailing directive after interpreting the regex brace as JavaScript syntax.
//
//  1. Parse nested substitutions containing brace, character-class, and slash regexes.
//  2. Place a genuine `@ts-ignore` comment after the completed template.
//  3. Assert the ban diagnostic covers exactly that comment and no literal bytes.
//
// @evidence contracts/testing.md#behavioral-verification Comment scanning resumes after nested templates and regex literals to report the real trailing ignore.
// @evidence contracts/testing.md#independent-expectations The authored trailing comment substring independently determines the only expected range; regex braces and escaped slash are expression content.
// @evidence contracts/testing.md#distinguishing-cases Nested templates, regex braces and escaped delimiters distinguish lexical resumption from prematurely ending template expressions.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngine.Run execute the authored lexical fixture; this entry compares the trailing comment offset and count. No consumer install or native product-host build/launch is used.
func TestBanTsCommentFollowsRegexInNestedTemplate(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  source := "const value = `${`${1}`} ${/[}]/.test(\"}\")} ${/a\\/b/.test(\"a/b\")} ${/[{]/.test(\"{\")}`;\n// @ts-ignore\nconst answer: number = 1;\nJSON.stringify([value, answer]);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  start := strings.Index(source, "// @ts-ignore")
  end := start + len("// @ts-ignore")
  if findings[0].Pos != start || findings[0].End != end {
    t.Fatalf("want exact range [%d,%d), got [%d,%d)", start, end, findings[0].Pos, findings[0].End)
  }
}
