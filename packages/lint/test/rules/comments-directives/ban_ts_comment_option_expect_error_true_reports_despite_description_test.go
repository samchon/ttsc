package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentOptionExpectErrorTrueReportsDespiteDescription verifies
// the `ts-expect-error: true` option bans the directive outright.
//
// `true` means "report every use": a description that would satisfy
// `allow-with-description` must not rescue the comment, and the message is
// the generic ban text, not the description-length complaint.
//
// 1. Configure `{"ts-expect-error": true}`.
// 2. Lint a directive with a full description.
// 3. Assert one finding with the do-not-use message.
func TestBanTsCommentOptionExpectErrorTrueReportsDespiteDescription(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const message = "Do not use `@ts-expect-error` because it alters compilation errors."
  source := "// @ts-expect-error: Suppress next line\nconst a: number = 1;\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(`{"ts-expect-error": true}`)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if findings[0].Message != message {
    t.Fatalf("message mismatch:\nwant %q\ngot  %q", message, findings[0].Message)
  }
}
