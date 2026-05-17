package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaModeNoneDisablesRule verifies that
// `mode: "none"` short-circuits the entire rule.
//
// The `"none"` mode is the runtime equivalent of `"format/trailing-comma":
// "off"`, with the difference that the rule remains registered (so
// future severity bumps via overrides don't accidentally re-enable it
// at a different mode). The early-return at the top of Check is the
// only thing standing between this contract and the rule firing on
// every multi-line literal anyway.
//
//  1. Parse a file with a multi-line array literal that would otherwise
//     trigger the rule.
//  2. Run the engine with `mode: "none"` configured.
//  3. Assert zero findings.
func TestFormatTrailingCommaModeNoneDisablesRule(t *testing.T) {
  source := "const xs = [\n  1,\n  2,\n  3\n];\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/trailing-comma": SeverityError},
    Options: RuleOptionsMap{
      "format/trailing-comma": json.RawMessage(`{"mode":"none"}`),
    },
  }
  findings := NewEngineWithResolver(resolver).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings with mode:\"none\", got %d", len(findings))
  }
}
