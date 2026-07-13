package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentOptionTsNocheckAllowWithDescription verifies the
// `ts-nocheck: "allow-with-description"` option and its interaction with
// the first-statement gate.
//
// A described pragma passes, a bare one reports the requires-description
// message, and a pragma after the first statement stays silent even under
// the description arm — the position gate runs before any policy, because
// an inert pragma is not worth describing.
//
// 1. Assert a described top-of-file `@ts-nocheck` produces zero findings.
// 2. Assert a bare top-of-file `@ts-nocheck` reports requires-description.
// 3. Assert a post-statement `@ts-nocheck` stays silent under this option.
func TestBanTsCommentOptionTsNocheckAllowWithDescription(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const options = `{"ts-nocheck": "allow-with-description"}`
  assertRuleSkipsSourceWithOptions(
    t,
    ruleName,
    "// @ts-nocheck no doubt, people will put nonsense here from time to time just to get the rule to stop reporting\nconst a: number = 1;\nJSON.stringify(a);\n",
    options,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    ruleName,
    "const a = 1;\n// @ts-nocheck\nJSON.stringify(a);\n",
    options,
  )

  source := "// @ts-nocheck\nconst a: number = 1;\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(options)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if !strings.Contains(findings[0].Message, "Include a description after the `@ts-nocheck` directive") {
    t.Fatalf("want the requires-description message, got %q", findings[0].Message)
  }
}
