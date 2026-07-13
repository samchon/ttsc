package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentDefaultReportsIgnoreWithUpgradeMessage verifies the
// typescript/ban-ts-comment diagnostic emitted for a banned `@ts-ignore`.
//
// Upstream's `ts-ignore: true` arm uses a dedicated message that steers
// users toward `@ts-expect-error` (not the generic do-not-use text) and
// attaches a single suggestion edit replacing exactly the directive token.
// Pinning the message and the edit shape locks both against regression.
//
// 1. Lint `// @ts-ignore` above a statement with defaults.
// 2. Assert one finding with the exact upgrade message.
// 3. Assert one fix edit covering only `@ts-ignore` with the replacement text.
func TestBanTsCommentDefaultReportsIgnoreWithUpgradeMessage(t *testing.T) {
  const message = "Use `@ts-expect-error` instead of `@ts-ignore`, as `@ts-ignore` will do nothing if the following line is error-free."
  source := "// @ts-ignore\nconst a: number = 1;\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"typescript/ban-ts-comment": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if finding.Message != message {
    t.Fatalf("message mismatch:\nwant %q\ngot  %q", message, finding.Message)
  }
  if finding.Pos != 0 || finding.End != len("// @ts-ignore") {
    t.Fatalf("want range [0,%d), got [%d,%d)", len("// @ts-ignore"), finding.Pos, finding.End)
  }
  if len(finding.Fix) != 1 {
    t.Fatalf("want exactly 1 fix edit, got %+v", finding.Fix)
  }
  edit := finding.Fix[0]
  if edit.Pos != len("// ") || edit.End != len("// @ts-ignore") || edit.Text != "@ts-expect-error" {
    t.Fatalf("want edit [%d,%d)=%q, got [%d,%d)=%q",
      len("// "), len("// @ts-ignore"), "@ts-expect-error", edit.Pos, edit.End, edit.Text)
  }
}
