package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatJSDocHonorsCustomTagSynonymsOption verifies the
// `tagSynonyms` option layers on top of the built-in synonym table.
//
// User-supplied entries must augment the defaults, not replace them, so a
// project can normalize a private convention (here `@property` → `@prop`)
// without losing the standard `@return` → `@returns` rewrite. This pins
// the merge semantics.
//
// 1. Configure a custom synonym not in the default table.
// 2. Run the rule against a block exercising both the custom synonym and
//    a default one.
// 3. Assert both rewrites land.
func TestFormatJSDocHonorsCustomTagSynonymsOption(t *testing.T) {
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.ts")
  source := "/**\n * @property name\n * @return greeting\n */\nexport function greet(): string { return \"hi\"; }\n"
  writeFile(t, filePath, source)
  file := parseTSFile(t, filePath, source)

  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/jsdoc": SeverityError},
    Options: RuleOptionsMap{
      "format/jsdoc": json.RawMessage(`{"tagSynonyms":{"property":"prop"}}`),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if _, err := applyFindingFixes(root, findings); err != nil {
    t.Fatalf("applyFindingFixes: %v", err)
  }
  got, err := os.ReadFile(filePath)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  want := "/**\n * @prop name\n * @returns greeting\n */\nexport function greet(): string { return \"hi\"; }\n"
  if string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
