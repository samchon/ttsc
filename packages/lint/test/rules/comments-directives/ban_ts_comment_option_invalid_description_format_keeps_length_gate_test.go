package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentOptionInvalidDescriptionFormatKeepsLengthGate verifies
// an uncompilable `descriptionFormat` degrades to the length gate only.
//
// Upstream would throw while constructing the RegExp; this host cannot
// fail the run from inside a rule, so the deliberate fallback keeps the
// description requirement the object form implies and drops only the
// unenforceable pattern. Silently allowing everything would erase the
// user's clear intent to police descriptions.
//
// 1. Configure `ts-expect-error: { descriptionFormat: "(" }`.
// 2. Assert a bare directive still reports requires-description.
// 3. Assert a described directive passes without a format complaint.
func TestBanTsCommentOptionInvalidDescriptionFormatKeepsLengthGate(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const options = `{"ts-expect-error": {"descriptionFormat": "("}}`
  assertRuleSkipsSourceWithOptions(
    t,
    ruleName,
    "// @ts-expect-error described well enough\nconst a: number = 1;\nJSON.stringify(a);\n",
    options,
  )

  source := "// @ts-expect-error\nconst a: number = 1;\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(options)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if !strings.Contains(findings[0].Message, "Include a description after the `@ts-expect-error` directive") {
    t.Fatalf("want the requires-description message, got %q", findings[0].Message)
  }
}
