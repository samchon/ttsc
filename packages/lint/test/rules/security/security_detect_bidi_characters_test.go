package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestSecurityDetectBidiCharacters verifies security rule: detect-bidi-characters reports Trojan Source controls.
//
// Locks the source-file scanning path because bidi controls can hide inside
// literals or comments before the AST exposes ordinary JavaScript tokens.
//
// 1. Parse a file containing one right-to-left override character.
// 2. Enable only `security/detect-bidi-characters`.
// 3. Assert one security finding is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run reports the right-to-left override in a source literal and remains silent on ordinary text, Hebrew letters and a textual escape spelling.
// @evidence contracts/testing.md#independent-expectations U+202E is a Unicode directional formatting control; ordinary Unicode letters and source text spelling an escaped backslash are not such controls. The expected count is authored independently.
// @evidence contracts/testing.md#distinguishing-cases Pairs the actual directional control with ASCII, non-ASCII ordinary characters and a textual escape lookalike; this is source scanning rather than runtime string interpretation.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngine.Run execute the control-containing source, then each of the three authored clean sources in the Go process. This entry owns the positive rule/count and every clean-loop result.
func TestSecurityDetectBidiCharacters(t *testing.T) {
  file := parseTS(t, "const access = \"user\u202e\";\n")
  findings := NewEngine(RuleConfig{
    "security/detect-bidi-characters": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 || findings[0].Rule != "security/detect-bidi-characters" {
    t.Fatalf("want one bidi finding, got %+v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  for _, source := range []string{
    "const access = \"user\";\n",
    "const access = \"שלום\";\n",
    `const access = "user\\u202e";`,
  } {
    clean := parseTS(t, source)
    cleanFindings := NewEngine(RuleConfig{
      "security/detect-bidi-characters": SeverityError,
    }).Run([]*shimast.SourceFile{clean}, nil)
    if len(cleanFindings) != 0 {
      t.Errorf("ordinary source %q produced bidi findings: %+v", source, cleanFindings)
    }
  }
}
