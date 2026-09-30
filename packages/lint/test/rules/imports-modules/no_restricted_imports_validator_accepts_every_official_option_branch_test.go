package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsValidatorAcceptsEveryOfficialOptionBranch verifies ConfigError accepts eight supported option representations, keeps the rule enabled at error severity and does not request a checker.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification ConfigError accepts eight supported option representations, keeps the rule enabled at error severity and does not request a checker.
// @evidence contracts/testing.md#independent-expectations The official path/pattern option contract admits missing, positional, object, empty, grouped and regex forms; expected activation and AST-only capability are literal requirements.
// @evidence contracts/testing.md#distinguishing-cases Empty arrays, allow/deny import names, case/regex/group patterns and type exemptions exercise distinct valid schema branches; malformed rejection is owned by the sibling validator.
// @evidence contracts/testing.md#execution-ownership Each authored valid option object is passed to noRestrictedImportsValidationEngine, which calls NewEngineWithResolver. This entry owns ConfigError, EnabledRules and NeedsTypeChecker assertions for every loop iteration.
func TestNoRestrictedImportsValidatorAcceptsEveryOfficialOptionBranch(t *testing.T) {
  valid := []json.RawMessage{
    nil,
    json.RawMessage(`"fs"`),
    json.RawMessage(`["fs",{"name":"pkg","message":"Use another module.","importNames":[],"allowTypeImports":true}]`),
    json.RawMessage(`{}`),
    json.RawMessage(`{"paths":[],"patterns":[]}`),
    json.RawMessage(`{"paths":["fs",{"name":"pkg","allowImportNames":[]}],"patterns":["pkg/*","!pkg/public"]}`),
    json.RawMessage(`{"patterns":[{"group":["pkg/*"],"importNames":["one"],"importNamePattern":"^unsafe","caseSensitive":true,"allowTypeImports":true}]}`),
    json.RawMessage(`{"patterns":[{"regex":"^pkg/","allowImportNames":["safe"]},{"regex":"^other/","allowImportNamePattern":"^public"}]}`),
  }
  for _, options := range valid {
    engine := noRestrictedImportsValidationEngine(options)
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("valid no-restricted-imports options %s were rejected: %v", options, err)
    }
    if engine.EnabledRules()["no-restricted-imports"] != SeverityError {
      t.Fatalf("valid no-restricted-imports options did not activate the rule: %v", engine.EnabledRules())
    }
    if engine.NeedsTypeChecker() {
      t.Fatal("no-restricted-imports unexpectedly requested a type checker")
    }
  }
}
