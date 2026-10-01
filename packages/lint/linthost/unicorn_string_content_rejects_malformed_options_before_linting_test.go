package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornStringContentRejectsMalformedOptionsBeforeLinting verifies
// every malformed configuration shape becomes a ConfigError.
//
// The rule's options carry executable content (regular expressions, AST
// selectors), so a typo must fail engine construction loudly instead of
// silently disabling the replacement — the exact failure mode the original
// no-op stub shipped. Each arm pins one schema constraint from the upstream
// rule (`additionalProperties: false`, required `suggest`, typed switches,
// unique string selectors) plus the regex/selector compile step.
//
//  1. Build an engine with each malformed options payload.
//  2. Assert ConfigError is non-nil and names the offending piece.
//  3. Keep one well-formed control arm that must NOT error.
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver.ConfigError must reject each malformed options payload with its authored explanation fragment and accept one fully populated valid control.
// @evidence contracts/testing.md#independent-expectations The documented option surface and official Unicorn additionalProperties/required/type/uniqueItems schema define accepted shapes; regex and selector grammars define malformed executable strings.
// @evidence contracts/testing.md#distinguishing-cases Arrays/scalars, unknown keys, invalid pattern values, missing suggest, wrongly typed switches/messages, malformed regex and selector variants remain separately named; the complete valid object must not fail.
// @evidence contracts/testing.md#execution-ownership TestUnicornStringContentRejectsMalformedOptionsBeforeLinting is the owning discoverable Go unit entry; its explicit variants and named t.Run cases preserve failure identity while engine construction and option/schema/regex/selector validation share one Go process. No source fixtures are materialized; no installed consumer, native build or product child host runs.
func TestUnicornStringContentRejectsMalformedOptionsBeforeLinting(t *testing.T) {
  cases := []struct {
    name    string
    options string
    want    string
  }{
    {name: "array options", options: `[{"patterns":{}}]`, want: "must be a single object"},
    {name: "scalar options", options: `"patterns"`, want: "must be a single object"},
    {name: "unknown top-level key", options: `{"patternz":{}}`, want: "unknown key"},
    {name: "patterns not an object", options: `{"patterns":["no"]}`, want: "must be an object"},
    {name: "pattern value number", options: `{"patterns":{"no":1}}`, want: "replacement string"},
    {name: "pattern value null", options: `{"patterns":{"no":null}}`, want: "replacement string"},
    {name: "pattern object missing suggest", options: `{"patterns":{"no":{"fix":false}}}`, want: `requires "suggest"`},
    {name: "pattern object unknown key", options: `{"patterns":{"no":{"suggest":"yes","fixx":true}}}`, want: "only suggest, fix, caseSensitive, and message"},
    {name: "suggest not a string", options: `{"patterns":{"no":{"suggest":1}}}`, want: `"suggest" must be a string`},
    {name: "fix not a boolean", options: `{"patterns":{"no":{"suggest":"yes","fix":"never"}}}`, want: `"fix" must be a boolean`},
    {name: "caseSensitive not a boolean", options: `{"patterns":{"no":{"suggest":"yes","caseSensitive":0}}}`, want: `"caseSensitive" must be a boolean`},
    {name: "message not a string", options: `{"patterns":{"no":{"suggest":"yes","message":true}}}`, want: `"message" must be a string`},
    {name: "invalid regex pattern", options: `{"patterns":{"(":"x"}}`, want: "valid regular expression"},
    {name: "selectors not an array", options: `{"patterns":{"no":"yes"},"selectors":"Literal"}`, want: "array of unique strings"},
    {name: "selector not a string", options: `{"patterns":{"no":"yes"},"selectors":[1]}`, want: "array of unique strings"},
    {name: "duplicate selectors", options: `{"patterns":{"no":"yes"},"selectors":["Literal","Literal"]}`, want: "duplicate"},
    {name: "invalid selector", options: `{"patterns":{"no":"yes"},"selectors":["["]}`, want: "selector 1"},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      engine := NewEngineWithResolver(InlineRuleResolver{
        Rules: RuleConfig{"unicorn/string-content": SeverityError},
        Options: RuleOptionsMap{
          "unicorn/string-content": json.RawMessage(test.options),
        },
      })
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), test.want) {
        t.Fatalf("ConfigError: want substring %q, got %v", test.want, err)
      }
    })
  }

  t.Run("well-formed options pass validation", func(t *testing.T) {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules: RuleConfig{"unicorn/string-content": SeverityError},
      Options: RuleOptionsMap{
        "unicorn/string-content": json.RawMessage(
          `{"patterns":{"no":{"suggest":"yes","fix":false,"caseSensitive":false,"message":"m"}},"selectors":["Literal"]}`,
        ),
      },
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("well-formed options must not error, got %v", err)
    }
  })
}
