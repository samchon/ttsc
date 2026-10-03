package linthost

import (
  "reflect"
  "strings"
  "testing"
)

// TestLintCorpusExpectationParserResolvesLineAndJSXBlockMarkers verifies that
// both marker spellings anchor to the line they annotate.
//
// JSX fixtures cannot place a `//` comment between JSX children, so the
// `{ /* expect: ... */ }` spelling must anchor like the line form. Stacked
// markers share one target, blank lines are skipped, prose that merely mentions
// `expect` is not a marker, and `typescript/ban-ts-comment` anchors on the
// suppressor comment that other rules skip over.
//
// 1. Parse stacked line and JSX markers followed by one statement, surrounded by
//    prose that mentions expect.
// 2. Parse a ban-ts-comment marker followed by a suppressor.
// 3. Assert each marker resolves to its target line and prose yields none.
//
// @evidence contracts/testing.md#behavioral-verification corpusParseExpectations is called on authored source text and its returned rule, severity and target line are compared with literals for both spellings, the stack and the suppressor case.
// @evidence contracts/testing.md#independent-expectations Line numbers are counted by hand from the authored source (stack target line 8, suppressor target line 10); they follow the documented convention that a marker annotates the next non-blank, non-marker line.
// @evidence contracts/testing.md#distinguishing-cases Prose comments mentioning expect, a JSX prose comment and a declared identifier named expect are the negatives; the stacked pair, a blank gap, and the ban-ts-comment suppressor exception are the positives.
// @evidence contracts/testing.md#execution-ownership TestLintCorpusExpectationParserResolvesLineAndJSXBlockMarkers is a discoverable Go unit entry calling the pure parser on an in-memory string; no file, compiler or host is involved.
func TestLintCorpusExpectationParserResolvesLineAndJSXBlockMarkers(t *testing.T) {
  source := strings.Join([]string{
    "/** Mentions `// expect:` as prose, not as a marker. */",
    "// This prose comment mentions expect but is not a marker.",
    "{ /* This JSX prose comment mentions expect but is not a marker. */ }",
    "declare const expect: unknown;",
    "// expect: first/rule error",
    "{ /* expect: second/rule warn */ }",
    "",
    "const value = 1;",
    "// expect: typescript/ban-ts-comment error",
    "// @ts-ignore",
    "const ignored = value;",
  }, "\n")
  got, err := corpusParseExpectations(source)
  if err != nil {
    t.Fatal(err)
  }
  want := []corpusExpectation{
    {Rule: "first/rule", Severity: "error", Line: 8},
    {Rule: "second/rule", Severity: "warn", Line: 8},
    {Rule: "typescript/ban-ts-comment", Severity: "error", Line: 10},
  }
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("got %+v, want %+v", got, want)
  }
}
