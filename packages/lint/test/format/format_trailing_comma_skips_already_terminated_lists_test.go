package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaSkipsAlreadyTerminatedLists verifies idempotence.
//
// Like formatSemi, the fix loop runs each format rule up to maxFormatPasses
// times. Any rule that re-reports its own previous edit would burn the cap
// without producing useful output. This scenario pins the
// `rangeHasTrailingComma` shortcut so a source that already has the comma
// produces zero findings on the second pass.
//
// 1. Parse multi-line lists that already end in trailing commas.
// 2. Run the engine with formatTrailingComma enabled.
// 3. Assert zero findings.
func TestFormatTrailingCommaSkipsAlreadyTerminatedLists(t *testing.T) {
  source := "const xs = [\n  1,\n  2,\n];\nconst obj = {\n  a: 1,\n  b: 2,\n};\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"formatTrailingComma": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
}
