package linthost

import (
  "testing"
  "encoding/json"
)

// @evidence contracts/testing.md#behavioral-verification Unconfigured type restrictions must not impose implicit bans.
// @evidence contracts/testing.md#independent-expectations The authored wrapper and Local types must yield zero findings under nil, empty, empty-map and false/null policies.
// @evidence contracts/testing.md#distinguishing-cases Four policy forms share the same potentially banned source; explicit bans are independently exercised in MatchesEveryOfficialTypeSurfaceExactly.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedTypesHasNoImplicitDefaults invokes the registered rule over an in-process parsed source through runRuleFindingsSnapshot; no native plugin build, compiler child or installation is involved.
func TestNoRestrictedTypesHasNoImplicitDefaults(t *testing.T) {
  source := `
type A = Object;
type B = Function;
type C = Number;
type D = String;
type E = Boolean;
type F = Local;
`
  cases := []struct {
    name    string
    options json.RawMessage
  }{
    {name: "bare severity"},
    {name: "empty options", options: json.RawMessage(`{}`)},
    {name: "empty map", options: json.RawMessage(`{"types":{}}`)},
    {
      name: "disabled entries",
      options: json.RawMessage(
        `{"types":{"Object":false,"Function":null,"Number":false,"String":null,"Boolean":false,"Local":null}}`,
      ),
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      if findings := runNoRestrictedTypes(t, source, test.options); len(findings) != 0 {
        t.Fatalf("findings = %+v, want none", findings)
      }
    })
  }
}
