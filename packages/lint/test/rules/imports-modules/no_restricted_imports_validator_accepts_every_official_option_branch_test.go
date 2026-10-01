package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsValidatorAcceptsEveryOfficialOptionBranch verifies
// engine construction accepts eight valid no-restricted-imports option shapes,
// leaves the rule enabled at error severity and does not ask for a type checker.
//
// The eight values are: no options, a bare string path, a mixed positional
// array, an empty object, empty paths and patterns, paths with string patterns,
// an object pattern with group, importNames, importNamePattern, caseSensitive
// and allowTypeImports, and two regex patterns with allowImportNames and
// allowImportNamePattern.
//
// 1. Build an engine through noRestrictedImportsValidationEngine for each value.
// 2. Require no ConfigError, error severity in EnabledRules and no type-checker need.
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver, driven through noRestrictedImportsValidationEngine, reports no ConfigError for each of the eight option values, lists no-restricted-imports as enabled at error severity, and reports that no type checker is required.
// @evidence contracts/testing.md#independent-expectations The official path and pattern option contract admits missing, positional, object, empty, grouped and regex forms; the acceptance, activation and checker-free requirements are literal expectations rather than derived from decoder output.
// @evidence contracts/testing.md#distinguishing-cases The eight values exercise distinct valid branches: empty importNames and allowImportNames arrays, allowTypeImports, group and regex patterns, name patterns and caseSensitive. Rejection of malformed values belongs to the sibling validator Test.
// @evidence contracts/testing.md#execution-ownership noRestrictedImportsValidationEngine calls NewEngineWithResolver with an InlineRuleResolver in the Go test process; the Test body asserts ConfigError, EnabledRules and NeedsTypeChecker for each of the eight values in a loop. No source file is parsed.
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
