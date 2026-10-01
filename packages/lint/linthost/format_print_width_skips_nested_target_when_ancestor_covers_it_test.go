package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatPrintWidthSkipsNestedTargetWhenAncestorCoversIt verifies the
// rule visits only the outermost reflow target on the way down a tree.
//
// Nested reflow targets must have one edit owner. Counting only the original
// short array cannot distinguish ancestor suppression from its fitting fast
// path, so a second fixture uses an independently overflowing nested object.
// Its diagnostic must cover exactly the outer call, and its complete edited
// source must retain every argument, property and value.
//
// 1. Retain the original short-array outer-call count and rule assertions.
// 2. Run a call containing a wide object at printWidth=24.
// 3. Assert one complete outer-call range and the independent full output.
//
// @evidence contracts/testing.md#behavioral-verification The original outer-call count/rule checks remain. A long nested object must yield exactly one complete outer-call range, and the applied full output must preserve all values, argument order and use syntax.
// @evidence contracts/testing.md#independent-expectations Independent source literals define the complete outer-call byte range. Installed Prettier 3.8.3 at width24 supplies the authored nested-object whole output; neither oracle derives ownership or bytes from the rule walker.
// @evidence contracts/testing.md#distinguishing-cases The original short nested array can fit independently and is not alone a distinguishing guard case. The added nested object itself overflows, so duplicate reflow would create an extra finding; flat-short and direct ancestor predicates are complementary.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthSkipsNestedTargetWhenAncestorCoversIt owns its original direct engine assertions plus nested-object exact-range and literal full-output cases in the selected public Go unit population. Owning operations, engine and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
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
  nestedSource := "process({ alpha: 1, bravo: 2, charlie: 3 }, \"hello\", \"world\");\n"
  _, _, nestedFindings := runRuleFindingsSnapshot(t, "format/print-width", nestedSource, json.RawMessage(`{"printWidth":24}`))
  marker := "process({ alpha: 1, bravo: 2, charlie: 3 }, \"hello\", \"world\")"
  if len(nestedFindings) != 1 || nestedFindings[0].Pos != 0 || nestedFindings[0].End != len(marker) {
    t.Fatalf("nested overflowing object must belong to one complete outer call: %+v", nestedFindings)
  }
  assertFixSnapshotWithOptions(t, "format/print-width", nestedSource, `{"printWidth":24}`, "process(\n  {\n    alpha: 1,\n    bravo: 2,\n    charlie: 3,\n  },\n  \"hello\",\n  \"world\",\n);\n")
}
