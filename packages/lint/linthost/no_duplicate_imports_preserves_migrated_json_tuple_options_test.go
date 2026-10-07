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
// @evidence contracts/testing.md#behavioral-verification LoadConfigResolver discovers the lint.config.json written into a temporary project, decodes its `["error", {allowSeparateTypeImports: true}]` tuple, and NewEngineWithResolver.Run executes the rule over the parsed source. The same-module value/type import pair on lines 1-2 stays clean while the two mergeable named imports on lines 3-4 report once, at line 4.
// @evidence contracts/testing.md#independent-expectations The expected single no-duplicate-imports finding at error severity on line 4 is a literal derived from the rule contract: allowSeparateTypeImports exempts a value import beside a clause-level type import, and does not exempt two value-named imports of one module.
// @evidence contracts/testing.md#distinguishing-cases One source holds the option-dependent negative (lines 1-2) and the rule-active positive (lines 3-4). The ConfigError check and the EnabledRules severity check prevent a missing or disabled rule from passing as a false zero, and requiring exactly one finding rejects a lost options object, which would also flag line 2.
// @evidence contracts/testing.md#execution-ownership The Test writes tsconfig.json and lint.config.json into t.TempDir, calls LoadConfigResolver, then runs NewEngineWithResolver.Run over a parseTSFile result in the Go test process. It starts no native host or installed consumer.
func TestNoDuplicateImportsPreservesMigratedJSONTupleOptions(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(root, "lint.config.json"), `{"rules":{"no-duplicate-imports":["error",{"allowSeparateTypeImports":true}]}}`)
  source := "import api from \"separate-type-module\";\nimport type { IEntity } from \"separate-type-module\";\nimport { alpha } from \"duplicate-module\";\nimport { beta } from \"duplicate-module\";\nJSON.stringify({ api, alpha, beta });"
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
