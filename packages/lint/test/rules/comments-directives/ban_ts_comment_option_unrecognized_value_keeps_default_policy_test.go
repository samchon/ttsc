package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentOptionUnrecognizedValueKeepsDefaultPolicy verifies
// out-of-union option values fall back to the directive's default.
//
// Upstream rejects such configs through its JSON schema; this host has no
// schema layer, so the deliberate behavior is to keep the documented
// default rather than invent a stricter or looser policy from garbage.
// This pins that choice so it cannot drift silently.
//
//  1. Configure `ts-ignore: 5` (not boolean/string/object) and assert a
//     bare `@ts-ignore` still reports the default upgrade message.
//  2. Configure `ts-expect-error: "allow"` (unknown literal) and assert a
//     bare `@ts-expect-error` still reports requires-description.
func TestBanTsCommentOptionUnrecognizedValueKeepsDefaultPolicy(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  run := func(source, optsJSON string) *Finding {
    t.Helper()
    file := parseTS(t, source)
    resolver := InlineRuleResolver{
      Rules:   RuleConfig{ruleName: SeverityError},
      Options: RuleOptionsMap{ruleName: json.RawMessage(optsJSON)},
    }
    findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
    if len(findings) != 1 {
      t.Fatalf("%s: want 1 finding, got %d (%+v)", optsJSON, len(findings), findings)
    }
    return findings[0]
  }

  ignore := run("// @ts-ignore\nconst a = 1;\nJSON.stringify(a);\n", `{"ts-ignore": 5}`)
  if !strings.Contains(ignore.Message, "Use `@ts-expect-error` instead of `@ts-ignore`") {
    t.Fatalf("want the default upgrade message, got %q", ignore.Message)
  }

  expectError := run("// @ts-expect-error\nconst a = 1;\nJSON.stringify(a);\n", `{"ts-expect-error": "allow"}`)
  if !strings.Contains(expectError.Message, "Include a description after the `@ts-expect-error` directive") {
    t.Fatalf("want the default requires-description message, got %q", expectError.Message)
  }
}
