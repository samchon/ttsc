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
// minimum, a description one character short must fail, and a zero
// minimum accepts even a bare directive. Off-by-one here silently flips
// every justified suppression in a codebase.
//
// 1. Assert a description of exactly the configured length is allowed.
// 2. Assert a description one character short of 21 reports the threshold.
// 3. Assert `minimumDescriptionLength: 0` allows a bare directive.
// 4. Assert a `: TODO` description under a minimum of 10 reports the threshold.
//
// @evidence contracts/testing.md#behavioral-verification Configured minimum accepts exact threshold and zero threshold while rejecting a description one character short and a far shorter one, each with the configured value in its message.
// @evidence contracts/testing.md#independent-expectations The authored exactly 21 characters description meets 21; missing text meets zero; TODO is shorter than ten independently.
// @evidence contracts/testing.md#distinguishing-cases Exact, one-short, zero and far-below-limit inputs distinguish inclusive threshold and customized message behavior.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSourceWithOptions owns both boundary allowances; runRuleFindingsSnapshot owns the one-short check and parseTS/NewEngineWithResolver.Run owns the far-below-limit check within this Test. No consumer install or native product-host build/launch is used.
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

  // One character below the 21 threshold: "exactly 21 character" has 20.
  _, _, belowByOne := runRuleFindingsSnapshot(
    t,
    ruleName,
    "// @ts-expect-error exactly 21 character\nconst a: number = 1;\nJSON.stringify(a);\n",
    json.RawMessage(`{"minimumDescriptionLength": 21, "ts-expect-error": "allow-with-description"}`),
  )
  if len(belowByOne) != 1 || !strings.Contains(belowByOne[0].Message, "must be 21 characters or longer") {
    t.Fatalf("20-character description under a 21 minimum: want 1 finding naming 21, got %+v", belowByOne)
  }

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
