package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentOptionTsCheckTrueReportsPragmaAnywhere verifies the
// `ts-check: true` option reports the pragma wherever it appears.
//
// Unlike `@ts-nocheck`, upstream applies no first-statement gate to
// `@ts-check` (its unreachable-code invalid case reports a mid-file
// pragma at column 3), so both a top-of-file and an indented in-block
// pragma must report with the generic ban message.
//
//  1. Configure `{"ts-check": true}` and lint a file with the pragma at the
//     top and inside an `if` block.
//  2. Assert two findings with the exact message.
//  3. Assert the second finding starts at the indented comment's offset.
//
// @evidence contracts/testing.md#behavioral-verification True ts-check policy reports leading and indented pragmas with the exact prohibition message.
// @evidence contracts/testing.md#independent-expectations The authored true option bans recognized ts-check comment syntax at both positions, even though a mid-file pragma does not enable compiler file checking; literal message and nested-comment offset are independent.
// @evidence contracts/testing.md#distinguishing-cases Two positions distinguish a file-leading-only scan from recognition inside code blocks.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngineWithResolver.Run produce both findings; this entry owns count, every message and the indented offset. No consumer install or native product-host build/launch is used.
func TestBanTsCommentOptionTsCheckTrueReportsPragmaAnywhere(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const message = "Do not use `@ts-check` because it alters compilation errors."
  source := "// @ts-check\nif (false) {\n  // @ts-check: Unreachable code error\n  JSON.stringify(1);\n}\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(`{"ts-check": true}`)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 2 {
    t.Fatalf("want 2 findings, got %d (%+v)", len(findings), findings)
  }
  for _, finding := range findings {
    if finding.Message != message {
      t.Fatalf("message mismatch:\nwant %q\ngot  %q", message, finding.Message)
    }
  }
  indented := strings.Index(source, "// @ts-check: Unreachable code error")
  if findings[1].Pos != indented {
    t.Fatalf("want indented finding at %d, got %d", indented, findings[1].Pos)
  }
}
