package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornTemplateIndentRejectsMalformedOptionsBeforeLinting verifies that actual engine construction requires ConfigError and authored fragments for every named malformed option payload.
//
// The public indent/list/selector schema independently rejects invalid types, whitespace, duplicates and selector syntax.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification Actual engine construction requires ConfigError and authored fragments for every named malformed option payload.
// @evidence contracts/testing.md#independent-expectations The public indent/list/selector schema independently rejects invalid types, whitespace, duplicates and selector syntax.
// @evidence contracts/testing.md#distinguishing-cases Nonobject/unknown, empty/nonwhitespace/zero/fraction indent and invalid list/selector inputs retain all named failures.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentRejectsMalformedOptionsBeforeLinting owns its explicit variants and named subcases as a discoverable Go unit entry; direct configured engine construction compares ConfigError fragments for all eleven named invalid options in the Go test process without creating fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornTemplateIndentRejectsMalformedOptionsBeforeLinting(t *testing.T) {
  cases := []struct {
    name    string
    options string
    want    string
  }{
    {name: "not object", options: `[]`, want: "must be an object"},
    {name: "unknown key", options: `{"tagz":[]}`, want: "contain only indent"},
    {name: "empty indent", options: `{"indent":""}`, want: "must not be empty"},
    {name: "non whitespace indent", options: `{"indent":" x"}`, want: "only whitespace"},
    {name: "non ECMAScript whitespace indent", options: `{"indent":"\u0085"}`, want: "only whitespace"},
    {name: "zero indent", options: `{"indent":0}`, want: "positive integer"},
    {name: "fraction indent", options: `{"indent":1.5}`, want: "positive integer"},
    {name: "null tags", options: `{"tags":null}`, want: "array of unique strings"},
    {name: "non string tag", options: `{"tags":[1]}`, want: "array of unique strings"},
    {name: "duplicate function", options: `{"functions":["dedent","dedent"]}`, want: "must not contain duplicate"},
    {name: "invalid selector", options: `{"selectors":["["]}`, want: "selector 1"},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      engine := NewEngineWithResolver(InlineRuleResolver{
        Rules: RuleConfig{unicornTemplateIndentRuleName: SeverityError},
        Options: RuleOptionsMap{
          unicornTemplateIndentRuleName: json.RawMessage(test.options),
        },
      })
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), test.want) {
        t.Fatalf("ConfigError: want substring %q, got %v", test.want, err)
      }
    })
  }
}
