package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentOptionDescriptionFormatChecksLengthFirst verifies the
// evaluation order between the length gate and the format gate.
//
// Upstream reports the requires-description message — never the format
// message — when a description matching the format is still shorter than
// `minimumDescriptionLength`. Swapping the order would emit a misleading
// "must match format" complaint for a description that already matches.
//
// 1. Configure the canonical format with a 25-character minimum.
// 2. Lint `: TS1234 because xyz` (matches the format, 20 characters).
// 3. Assert the single finding carries the length message with 25.
//
// @evidence contracts/testing.md#behavioral-verification Length failure takes precedence over a matching description format, with the configured 25 threshold in the message.
// @evidence contracts/testing.md#independent-expectations The authored description matches the regex but is below 25 graphemes; the expected length complaint and absence of format text follow gate order.
// @evidence contracts/testing.md#distinguishing-cases Matching-but-short input distinguishes threshold checking from format acceptance or misleading format failure.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngineWithResolver.Run execute the authored options; this Test owns count and message inclusion/exclusion checks. No consumer install or native product-host build/launch is used.
func TestBanTsCommentOptionDescriptionFormatChecksLengthFirst(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  source := "// @ts-expect-error: TS1234 because xyz\nconst a: number = 1;\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(`{"minimumDescriptionLength": 25, "ts-expect-error": {"descriptionFormat": "^: TS\\d+ because .+$"}}`)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if !strings.Contains(findings[0].Message, "must be 25 characters or longer") {
    t.Fatalf("want the length message with the 25 threshold, got %q", findings[0].Message)
  }
  if strings.Contains(findings[0].Message, "format") {
    t.Fatalf("length gate must win over format gate, got %q", findings[0].Message)
  }
}
