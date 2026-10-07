package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornFilenameCaseOptionValidation verifies the ValidateOptions
// surface: accepted shapes have no configuration error, while malformed shapes
// produce a configuration error during engine construction.
//
// The native decoder permits either `case` or `cases`, rejects unknown keys,
// and validates a unique-pattern `ignore` array and boolean
// flags; both keys together, unknown keys, unknown case names, non-boolean
// values, duplicate ignore patterns, and uncompilable patterns are all
// rejected up front.
//
// 1. Bind engines over accepted and rejected option payloads.
// 2. Assert ConfigError is nil exactly for the accepted ones.
//
// @evidence contracts/testing.md#behavioral-verification Actual engine construction accepts legal filename options and rejects malformed shapes through ConfigError.
// @evidence contracts/testing.md#independent-expectations The supported case, cases, ignore and directory/extension option schema independently determines the retained valid/invalid payloads.
// @evidence contracts/testing.md#distinguishing-cases Legal option combinations and malformed option values remain distinct; case selection effects are verified by behavioral filename hosts.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseOptionValidation owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseOptionValidation(t *testing.T) {
  accepted := []string{
    `{}`,
    `{"case":"camelCase"}`,
    `{"case":"camelCaseWithAcronyms"}`,
    `{"case":"kebabCase"}`,
    `{"case":"snakeCase"}`,
    `{"case":"pascalCase"}`,
    `{"cases":{}}`,
    `{"cases":{"camelCase":true,"kebabCase":false}}`,
    `{"ignore":["^foo","bar$"]}`,
    `{"multipleFileExtensions":false,"checkDirectories":false}`,
  }
  for _, options := range accepted {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornFilenameCaseRuleName: SeverityError},
      Options: RuleOptionsMap{unicornFilenameCaseRuleName: json.RawMessage(options)},
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("options %s: want acceptance, got %v", options, err)
    }
  }

  rejected := []string{
    `"kebabCase"`,
    `[]`,
    `null`,
    `{"case":"kebab-case"}`,
    `{"case":true}`,
    `{"case":"kebabCase","cases":{"camelCase":true}}`,
    `{"cases":{"kebab-case":true}}`,
    `{"cases":{"kebabCase":"yes"}}`,
    `{"cases":["kebabCase"]}`,
    `{"unknown":true}`,
    `{"ignore":"^foo"}`,
    `{"ignore":["^foo","^foo"]}`,
    `{"ignore":["["]}`,
    `{"multipleFileExtensions":"no"}`,
    `{"checkDirectories":1}`,
  }
  for _, options := range rejected {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornFilenameCaseRuleName: SeverityError},
      Options: RuleOptionsMap{unicornFilenameCaseRuleName: json.RawMessage(options)},
    })
    if err := engine.ConfigError(); err == nil {
      t.Fatalf("options %s: want a config error, got none", options)
    }
  }
}
