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
// without an expect-error rewrite suggestion or automatic fix. Upstream only attaches the
// suggestion on the `true` arm, and rewriting an undescribed comment
// would not add the description the option demands.
//
// 1. Assert a described `@ts-ignore` produces zero findings.
// 2. Assert a bare `@ts-ignore` reports the requires-description message.
// 3. Assert the finding carries neither an automatic fix nor a suggestion.
//
// @evidence contracts/testing.md#behavioral-verification The ignore description option permits a long explanation but rejects a bare directive without providing an automatic rewrite or a rewrite suggestion.
// @evidence contracts/testing.md#independent-expectations Authored allow-with-description policy makes explanation the distinguishing property; literal message fragment and empty fix/suggestion channel expectations follow its contract.
// @evidence contracts/testing.md#distinguishing-cases Long and absent descriptions on the same directive distinguish allowance from unconditional ban.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSourceWithOptions owns the described source; parseTS/NewEngineWithResolver.Run owns the bare source, message and both empty edit-channel checks. No consumer install or native product-host build/launch is used.
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
  if len(findings[0].Suggestions) != 0 {
    t.Fatalf("description findings must not carry rewrite suggestions, got %+v", findings[0].Suggestions)
  }
}
