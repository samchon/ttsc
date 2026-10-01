package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentOptionMinimumDescriptionLengthBoundary verifies the
// `minimumDescriptionLength` threshold at its exact boundary.
//
// The upstream valid case "exactly 21 characters" passes a 21-character
// minimum, a shorter description one word away must fail, and a zero
// minimum accepts even a bare directive. Off-by-one here silently flips
// every justified suppression in a codebase.
//
// 1. Assert a description of exactly the configured length is allowed.
// 2. Assert a shorter description reports with the threshold in the message.
// 3. Assert `minimumDescriptionLength: 0` allows a bare directive.
//
// @evidence contracts/testing.md#behavioral-verification Configured minimum accepts exact threshold and zero threshold while rejecting a shorter description with the configured value in its message.
// @evidence contracts/testing.md#independent-expectations The authored exactly 21 characters description meets 21; missing text meets zero; TODO is shorter than ten independently.
// @evidence contracts/testing.md#distinguishing-cases Exact, zero and below-limit inputs distinguish inclusive threshold and customized message behavior.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSourceWithOptions owns both boundary allowances; parseTS/NewEngineWithResolver.Run owns the below-limit check within this Test. No consumer install or native product-host build/launch is used.
func TestBanTsCommentOptionMinimumDescriptionLengthBoundary(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  assertRuleSkipsSourceWithOptions(
    t,
    ruleName,
    "// @ts-expect-error exactly 21 characters\nconst a: number = 1;\nJSON.stringify(a);\n",
    `{"minimumDescriptionLength": 21, "ts-expect-error": "allow-with-description"}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    ruleName,
    "// @ts-expect-error\nconst a: number = 1;\nJSON.stringify(a);\n",
    `{"minimumDescriptionLength": 0, "ts-expect-error": "allow-with-description"}`,
  )

  source := "// @ts-expect-error: TODO\nconst a: number = 1;\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(`{"minimumDescriptionLength": 10, "ts-expect-error": "allow-with-description"}`)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("short description: want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if !strings.Contains(findings[0].Message, "must be 10 characters or longer") {
    t.Fatalf("message must carry the configured threshold, got %q", findings[0].Message)
  }
}
