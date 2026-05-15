package main

import (
  "encoding/json"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatPrintWidthSkipsNestedTargetWhenAncestorCoversIt verifies the
// rule visits only the outermost reflow target on the way down a tree.
//
// Both the outer call and the inner array literal match the rule's
// Visits set. If the rule emitted edits for both, the applier would
// reject overlapping ranges, and `ttsc fix` would spend cascade passes
// repeatedly applying then re-rejecting. The case pins the
// "ancestor-wins" decision by counting engine findings directly:
// asserting on rendered bytes alone is not enough, because the inner
// array in the fixture renders flat either way and the byte-level
// expectation passes whether the skip guard fires or not.
//
//  1. Configure printWidth=24.
//  2. Feed `process([1, 2, 3], "hello", "world");` — outer call breaks,
//     inner array would also be a visit target.
//  3. Run the engine and assert exactly one finding: the outer call.
//     A missing skip guard would surface as two findings (one for the
//     call, one for the array), tripping this assertion.
func TestFormatPrintWidthSkipsNestedTargetWhenAncestorCoversIt(t *testing.T) {
  source := "process([1, 2, 3], \"hello\", \"world\");\n"
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.ts")
  writeFile(t, filePath, source)
  file := parseTSFile(t, filePath, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/print-width": SeverityError},
    Options: RuleOptionsMap{
      "format/print-width": json.RawMessage(`{"printWidth": 24}`),
    },
  }
  findings := NewEngineWithResolver(resolver).Run(
    []*shimast.SourceFile{file}, nil,
  )
  if len(findings) != 1 {
    t.Fatalf("expected exactly one finding (outer call), got %d: %+v",
      len(findings), findings)
  }
  if findings[0].Rule != "format/print-width" {
    t.Fatalf("unexpected finding rule: %q", findings[0].Rule)
  }
}
