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
