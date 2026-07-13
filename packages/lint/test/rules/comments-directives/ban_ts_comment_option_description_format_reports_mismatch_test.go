package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentOptionDescriptionFormatReportsMismatch verifies the
// `{ descriptionFormat }` option rejects non-conforming descriptions.
//
// The pattern is matched against the RAW description — everything after
// the directive word including leading whitespace — so both a truncated
// description and one padded with extra spaces before the `:` must report
// with the format echoed in the message, exactly as upstream pins.
//
// 1. Configure `^: TS\d+ because .+$` for `ts-expect-error`.
// 2. Lint a truncated description and a whitespace-padded one.
// 3. Assert one finding each with the exact format-mismatch message.
func TestBanTsCommentOptionDescriptionFormatReportsMismatch(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const message = "The description for the `@ts-expect-error` directive must match the ^: TS\\d+ because .+$ format."
  for _, source := range []string{
    "// @ts-expect-error: TS1234\nconst a: number = 1;\nJSON.stringify(a);\n",
    "// @ts-expect-error    : TS1234 because xyz\nconst a: number = 1;\nJSON.stringify(a);\n",
  } {
    file := parseTS(t, source)
    resolver := InlineRuleResolver{
      Rules:   RuleConfig{ruleName: SeverityError},
      Options: RuleOptionsMap{ruleName: json.RawMessage(`{"ts-expect-error": {"descriptionFormat": "^: TS\\d+ because .+$"}}`)},
    }
    findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
    if len(findings) != 1 {
      t.Fatalf("%q: want 1 finding, got %d (%+v)", source, len(findings), findings)
    }
    if findings[0].Message != message {
      t.Fatalf("%q: message mismatch:\nwant %q\ngot  %q", source, message, findings[0].Message)
    }
  }
}
