package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentBlockCommentReportsDirectiveOnLastLine verifies
// typescript/ban-ts-comment matches `@ts-expect-error` on a block comment's
// final line.
//
// The compiler honors an error-suppression directive in a block comment
// only when it sits on the last line, so the rule (configured
// `ts-expect-error: true`) must report exactly those spellings, anchored
// at the comment's start.
//
//  1. Lint single-line, JSDoc, and multi-line block comments whose last
//     line carries the directive.
//  2. Assert one finding per source with the do-not-use message, starting
//     at the comment's byte offset.
//
// @evidence contracts/testing.md#behavioral-verification ban-ts-comment reports final-line expect-error with its exact ban message and full comment range.
// @evidence contracts/testing.md#independent-expectations The authored true option forbids the directive; literal message and first closing-delimiter offsets establish the expectation independently.
// @evidence contracts/testing.md#distinguishing-cases Five ordinary/JSDoc and newline/star-prefix forms contrast with the earlier-line clean sibling.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngineWithResolver.Run execute each source; this Test owns all message and range comparisons. No consumer install or native product-host build/launch is used.
func TestBanTsCommentBlockCommentReportsDirectiveOnLastLine(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const message = "Do not use `@ts-expect-error` because it alters compilation errors."
  for _, source := range []string{
    "/* @ts-expect-error */\nconst a = 1;\nJSON.stringify(a);\n",
    "/** @ts-expect-error */\nconst a = 1;\nJSON.stringify(a);\n",
    "/*\n@ts-expect-error */\nconst a = 1;\nJSON.stringify(a);\n",
    "/** on the last line\n  @ts-expect-error */\nconst a = 1;\nJSON.stringify(a);\n",
    "/** on the last line\n * @ts-expect-error */\nconst a = 1;\nJSON.stringify(a);\n",
  } {
    file := parseTS(t, source)
    resolver := InlineRuleResolver{
      Rules:   RuleConfig{ruleName: SeverityError},
      Options: RuleOptionsMap{ruleName: json.RawMessage(`{"ts-expect-error": true}`)},
    }
    findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
    if len(findings) != 1 {
      t.Fatalf("%q: want 1 finding, got %d (%+v)", source, len(findings), findings)
    }
    finding := findings[0]
    if finding.Message != message {
      t.Fatalf("%q: message mismatch:\nwant %q\ngot  %q", source, message, finding.Message)
    }
    commentEnd := strings.Index(source, "*/") + len("*/")
    if finding.Pos != 0 || finding.End != commentEnd {
      t.Fatalf("%q: want range [0,%d), got [%d,%d)", source, commentEnd, finding.Pos, finding.End)
    }
  }
}
