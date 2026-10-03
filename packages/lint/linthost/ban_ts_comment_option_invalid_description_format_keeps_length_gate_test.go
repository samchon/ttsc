package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentOptionInvalidDescriptionFormatKeepsLengthGate verifies
// an uncompilable `descriptionFormat` degrades to the length gate only.
//
// Upstream constructs a RegExp for a nonempty format. This host explicitly
// handles Go regexp compilation failure by keeping the description-length
// requirement and leaving the format matcher absent. The short rejection
// and long allowance distinguish that fallback from silently allowing every
// directive or banning every use. This case does not exercise panic recovery
// or the consumer config-loading boundary.
//
// 1. Configure `ts-expect-error: { descriptionFormat: "(" }`.
// 2. Assert a bare directive still reports requires-description.
// 3. Assert a described directive passes without a format complaint.
//
// @evidence contracts/testing.md#behavioral-verification An invalid format expression disables matching but preserves the description-length requirement.
// @evidence contracts/testing.md#independent-expectations The literal ( is unusable as a regex; supported fallback still rejects missing descriptions while accepting sufficient text.
// @evidence contracts/testing.md#distinguishing-cases Long-description allowance and bare-directive rejection guard against treating an invalid regex as full allowance or full ban.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSourceWithOptions owns allowance, and parseTS/NewEngineWithResolver.Run owns the missing-description finding in this entry. No consumer install or native product-host build/launch is used.
func TestBanTsCommentOptionInvalidDescriptionFormatKeepsLengthGate(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const options = `{"ts-expect-error": {"descriptionFormat": "("}}`
  assertRuleSkipsSourceWithOptions(
    t,
    ruleName,
    "// @ts-expect-error described well enough\nconst a: number = 1;\nJSON.stringify(a);\n",
    options,
  )

  source := "// @ts-expect-error\nconst a: number = 1;\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(options)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if !strings.Contains(findings[0].Message, "Include a description after the `@ts-expect-error` directive") {
    t.Fatalf("want the requires-description message, got %q", findings[0].Message)
  }
}
