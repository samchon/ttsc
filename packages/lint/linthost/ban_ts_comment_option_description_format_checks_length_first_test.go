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
// The length gate must report before the format gate when both fail. A
// matching-but-short description alone cannot distinguish reversed gates:
// matching the regex first would still fall through to the same length
// complaint. The nonmatching-but-short twin makes that order observable.
//
// 1. Configure the anchored format with a 25-character minimum.
// 2. Keep the matching 20-character description and add a short nonmatch.
// 3. Assert both report the 25-character length complaint without format text.
//
// @evidence contracts/testing.md#behavioral-verification Short descriptions report the configured 25-character threshold whether they match the format or fail both gates.
// @evidence contracts/testing.md#independent-expectations Both literal descriptions are below 25 graphemes; only : TS1234 because xyz matches the anchored regex, so the nonmatching twin independently makes length-before-format observable.
// @evidence contracts/testing.md#distinguishing-cases Matching-but-short preserves the existing length case; nonmatching-and-short distinguishes reversed format-first evaluation. Matching-long and nonmatching-long siblings own the other gate results.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngineWithResolver.Run execute both authored sources with the same options; this Test owns each count and message inclusion/exclusion check. No consumer install or native product-host build/launch is used.
func TestBanTsCommentOptionDescriptionFormatChecksLengthFirst(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  for _, source := range []string{
    "// @ts-expect-error: TS1234 because xyz\nconst a: number = 1;\nJSON.stringify(a);\n",
    "// @ts-expect-error: wrong\nconst a: number = 1;\nJSON.stringify(a);\n",
  } {
    file := parseTS(t, source)
    resolver := InlineRuleResolver{
      Rules:   RuleConfig{ruleName: SeverityError},
      Options: RuleOptionsMap{ruleName: json.RawMessage(`{"minimumDescriptionLength": 25, "ts-expect-error": {"descriptionFormat": "^: TS\\d+ because .+$"}}`)},
    }
    findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
    if len(findings) != 1 {
      t.Fatalf("%q: want 1 finding, got %d (%+v)", source, len(findings), findings)
    }
    if !strings.Contains(findings[0].Message, "must be 25 characters or longer") {
      t.Fatalf("%q: want the length message with the 25 threshold, got %q", source, findings[0].Message)
    }
    if strings.Contains(findings[0].Message, "format") {
      t.Fatalf("%q: length gate must win over format gate, got %q", source, findings[0].Message)
    }
  }
}
