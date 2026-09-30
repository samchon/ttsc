package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoDuplicateImportsPreservesMigratedJSONTupleOptions verifies the original
// built-in options tuple reaches duplicate-import analysis through JSON loading.
//
// The type/value pair must stay clean while an ordinary mergeable pair still
// reports, so neither a lost options object nor an inactive rule can pass.
//
// 1. Write the original lint.config.json tuple and five-line source.
// 2. Discover/load the JSON through LoadConfigResolver and bind it to the engine.
// 3. Require exactly no-duplicate-imports/error at line 4.
//
// @evidence contracts/testing.md#behavioral-verification LoadConfigResolver discovers lint.config.json, decodes its severity/options tuple and passes allowSeparateTypeImports to NewEngineWithResolver.Run. Exactly the duplicate-module named pair reports; the separate-type-module value/type pair stays clean.
// @evidence contracts/testing.md#independent-expectations The authored JSON tuple enables error severity and exempts unlike clause-level type categories, not same-category duplicates. The independently literal no-duplicate-imports/error/line-4 expectation is retained from the original consumer case, with its exact source input.
// @evidence contracts/testing.md#distinguishing-cases The one source contains both the option-dependent negative and rule-active positive. ConfigError and enabled severity checks prevent a missing or disabled rule producing a false zero; exact finding cardinality rejects lost option transport.
// @evidence contracts/testing.md#execution-ownership TestNoDuplicateImportsPreservesMigratedJSONTupleOptions writes fixture JSON, calls LoadConfigResolver, then NewEngineWithResolver.Run over parseTSFile output in the same Go process. It owns the original tuple-decoder and rule-semantics population; the consumer survivor owns installed/native diagnostic transport and exit. No consumer installation, native build or product-host process runs here.
func TestNoDuplicateImportsPreservesMigratedJSONTupleOptions(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(root, "lint.config.json"), `{"rules":{"no-duplicate-imports":["error",{"allowSeparateTypeImports":true}]}}`)
  source := "import api from \"separate-type-module\";\nimport type { IEntity } from \"separate-type-module\";\nimport { alpha } from \"duplicate-module\";\nimport { beta } from \"duplicate-module\";\nJSON.stringify({ api, alpha, beta });\n"
  resolver, err := LoadConfigResolver(&PluginEntry{}, root, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }
  engine := NewEngineWithResolver(resolver)
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("NewEngineWithResolver: %v", err)
  }
  if engine.EnabledRules()["no-duplicate-imports"] != SeverityError {
    t.Fatal("JSON tuple did not enable no-duplicate-imports at error severity")
  }
  file := parseTSFile(t, filepath.Join(root, "src", "main.ts"), source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := ruleExpectation{Rule: "no-duplicate-imports", Severity: SeverityError, Line: 4}
  if len(actual) != 1 || actual[0] != expected {
    t.Fatalf("want exactly %+v, got %+v", expected, actual)
  }
}
