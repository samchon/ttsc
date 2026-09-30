package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Five named inputs require successful configuration, enabled error severity and the real rule checker requirement.
// @evidence contracts/testing.md#independent-expectations Authored public-schema objects specify valid defaults/booleans/unique ignore arrays and regexes independently of validator output.
// @evidence contracts/testing.md#distinguishing-cases Omitted and empty options, props false, props true with ignores and ignores with omitted props remain accepted; invalid-schema cases own adjacent rejection boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoParamReassignOptionsValidatorAcceptsThePublicSchema is selected in the shared Go unit population. Each named subtest constructs InlineRuleResolver/Engine and calls ConfigError, EnabledRules and NeedsTypeChecker directly. No consumer install, native artifact build or real host runs.
func TestNoParamReassignOptionsValidatorAcceptsThePublicSchema(t *testing.T) {
  cases := []struct {
    name    string
    options json.RawMessage
  }{
    {name: "defaults", options: nil},
    {name: "empty object", options: json.RawMessage(`{}`)},
    {name: "props false", options: json.RawMessage(`{"props":false}`)},
    {
      name: "props true with both unique ignore lists",
      options: json.RawMessage(
        `{"props":true,"ignorePropertyModificationsFor":["first","second"],"ignorePropertyModificationsForRegex":["^safe$","^ignored\\d+$"]}`,
      ),
    },
    {
      name:    "ignore lists with props omitted",
      options: json.RawMessage(`{"ignorePropertyModificationsFor":["value"],"ignorePropertyModificationsForRegex":["^arg$"]}`),
    },
  }

  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      engine := noParamReassignValidationEngine(tc.options)
      if err := engine.ConfigError(); err != nil {
        t.Fatalf("valid no-param-reassign options were rejected: %v", err)
      }
      if engine.EnabledRules()["no-param-reassign"] != SeverityError {
        t.Fatalf("valid no-param-reassign options did not activate the rule: %v", engine.EnabledRules())
      }
      if !engine.NeedsTypeChecker() {
        t.Fatal("valid no-param-reassign options lost the rule's checker requirement")
      }
    })
  }
}
