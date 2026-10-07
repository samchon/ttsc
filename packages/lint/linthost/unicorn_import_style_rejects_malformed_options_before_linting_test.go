package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornImportStyleRejectsMalformedOptionsBeforeLinting verifies
// option validation happens at engine construction: the retained malformed
// payloads produce independently specified configuration-error fragments
// before any file is linted.
//
// Silent acceptance would let a typo disable the rule without any
// signal. Each rejection here must instead carry its authored error fragment.
//
//  1. Build an engine with each malformed payload.
//  2. Assert ConfigError carries the expected message fragment.
//
// @evidence contracts/testing.md#behavioral-verification Actual engine construction requires ConfigError and authored fragments for every named malformed payload.
// @evidence contracts/testing.md#independent-expectations The supported boolean-toggle and module/style object schema independently rejects the retained invalid types and keys.
// @evidence contracts/testing.md#distinguishing-cases Nonobject/null/unknown/toggle/module/style failures retain named identities; behavioral hosts supply legal configurations.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleRejectsMalformedOptionsBeforeLinting owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleRejectsMalformedOptionsBeforeLinting(t *testing.T) {
  cases := []struct {
    name    string
    options string
    want    string
  }{
    {name: "not object", options: `[]`, want: "must be an object"},
    {name: "unknown key", options: `{"stylez": {}}`, want: `unknown option "stylez"`},
    {name: "non-boolean toggle", options: `{"checkImport": "yes"}`, want: `option "checkImport" must be a boolean`},
    {name: "null toggle", options: `{"checkRequire": null}`, want: `option "checkRequire" must be a boolean`},
    {name: "styles not object", options: `{"styles": true}`, want: `option "styles" must be an object`},
    {name: "styles null", options: `{"styles": null}`, want: `option "styles" must be an object`},
    {name: "module string", options: `{"styles": {"util": "named"}}`, want: `styles entry "util" must be false or an object of booleans`},
    {name: "module true", options: `{"styles": {"util": true}}`, want: `styles entry "util" must be false or an object of booleans`},
    {name: "module null", options: `{"styles": {"util": null}}`, want: `styles entry "util" must be false or an object of booleans`},
    {name: "style non-boolean", options: `{"styles": {"util": {"named": "x"}}}`, want: `style "named" of module "util" must be a boolean`},
    {name: "style null", options: `{"styles": {"util": {"named": null}}}`, want: `style "named" of module "util" must be a boolean`},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      engine := NewEngineWithResolver(InlineRuleResolver{
        Rules: RuleConfig{unicornImportStyleRuleName: SeverityError},
        Options: RuleOptionsMap{
          unicornImportStyleRuleName: json.RawMessage(test.options),
        },
      })
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), test.want) {
        t.Fatalf("ConfigError: want substring %q, got %v", test.want, err)
      }
    })
  }
}
