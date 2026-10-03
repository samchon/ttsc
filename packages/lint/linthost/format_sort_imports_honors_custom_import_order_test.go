package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSortImportsHonorsCustomImportOrder verifies user-supplied `order`
// regexes drive the group sequence and "" entries inject blank-line separators.
//
// The fixture has three import classes, `@api/*`, plain third-party, and
// relative, in shuffled source order. With
// `order: ["<THIRD_PARTY_MODULES>", "", "@api(.*)$", "", "^[./]"]` the expected
// output is third-party first, then `@api/*`, then relative, with one blank
// line between each group. This pins the custom-order + separator path through
// the engine.
//
//  1. Parse a source file with mixed import classes.
//  2. Apply the custom order and separators with unsafe runtime sorting.
//  3. Assert the rewritten file has the imports laid out per the spec.
//
// @evidence contracts/testing.md#behavioral-verification Custom order must produce alpha, the api request, then local-a/local-b, with exactly two blank group separators and unchanged bindings/body. Applying and reparsing fixes must converge within the existing four-pass cap.
// @evidence contracts/testing.md#independent-expectations The supported order array assigns third-party, api-regex and relative groups in that sequence. A separately authored whole-file literal pins both separators, within-relative order and all preserved use bytes.
// @evidence contracts/testing.md#distinguishing-cases All three groups are populated here, contrasting the empty-middle-group separator host. Default group-order and CRLF hosts cover distinct options; the final zero-edit pass distinguishes oscillation.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsHonorsCustomImportOrder directly owns its literal source, InlineRuleResolver, engine/fixer/reparse loop and final complete-file assertion. These filesystem-backed owning functions execute in one Go process without consumer installation, native building or product-host children.
func TestFormatSortImportsHonorsCustomImportOrder(t *testing.T) {
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.ts")
  source := "import { reduce } from \"./local-b\";\n" +
    "import { request } from \"@api/http\";\n" +
    "import alpha from \"alpha\";\n" +
    "import { x } from \"./local-a\";\n" +
    "JSON.stringify({ reduce, request, alpha, x });\n"
  writeFile(t, filePath, source)
  file := parseTSFile(t, filePath, source)

  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/sort-imports": SeverityError},
    Options: RuleOptionsMap{
      "format/sort-imports": json.RawMessage(
        `{"order":["<THIRD_PARTY_MODULES>","","@api(.*)$","","^[./]"],"unsafeSortRuntimeImports":true}`,
      ),
    },
  }
  // Apply and reparse each fix until a pass makes no changes.
  const maxPasses = 4
  converged := false
  for pass := 0; pass < maxPasses; pass++ {
    findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
    fixed, err := applyFindingFixes(root, findings)
    if err != nil {
      t.Fatalf("applyFindingFixes: %v", err)
    }
    if fixed == 0 {
      converged = true
      break
    }
    raw, err := os.ReadFile(filePath)
    if err != nil {
      t.Fatalf("ReadFile: %v", err)
    }
    file = parseTSFile(t, filePath, string(raw))
  }
  if !converged {
    // A non-converged exit means the rule kept rewriting on every pass.
    // Either the test fixture grew complexity the rule cannot settle, or
    // the rule itself regressed into a re-emit loop. Either way we want a
    // loud failure instead of a misleading green when the loop falls
    // through with edits still pending.
    t.Fatalf("formatSortImports did not converge within %d passes", maxPasses)
  }
  got, err := os.ReadFile(filePath)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  expected := "import alpha from \"alpha\";\n\n" +
    "import { request } from \"@api/http\";\n\n" +
    "import { x } from \"./local-a\";\n" +
    "import { reduce } from \"./local-b\";\n" +
    "JSON.stringify({ reduce, request, alpha, x });\n"
  if string(got) != expected {
    t.Fatalf("custom-order full output mismatch:\nwant:\n%s\ngot:\n%s", expected, got)
  }
}
