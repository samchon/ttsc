package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentOptionTsIgnoreAllowWithDescription verifies the
// `ts-ignore: "allow-with-description"` option.
//
// The description arm replaces the default ban: a justified `@ts-ignore`
// must pass, and a bare one must report the requires-description message
// WITHOUT the expect-error rewrite fix — upstream only attaches the
// suggestion on the `true` arm, and auto-rewriting an undescribed comment
// would not add the description the option demands.
//
// 1. Assert a described `@ts-ignore` produces zero findings.
// 2. Assert a bare `@ts-ignore` reports the requires-description message.
// 3. Assert the finding carries no fix edit.
func TestBanTsCommentOptionTsIgnoreAllowWithDescription(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const options = `{"ts-ignore": "allow-with-description"}`
  assertRuleSkipsSourceWithOptions(
    t,
    ruleName,
    "// @ts-ignore I think that I am exempted from any need to follow the rules!\nconst a: number = 1;\nJSON.stringify(a);\n",
    options,
  )

  source := "// @ts-ignore\nconst a: number = 1;\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(options)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if !strings.Contains(findings[0].Message, "Include a description after the `@ts-ignore` directive") {
    t.Fatalf("want the requires-description message, got %q", findings[0].Message)
  }
  if len(findings[0].Fix) != 0 {
    t.Fatalf("description findings must not carry the rewrite fix, got %+v", findings[0].Fix)
  }
}
