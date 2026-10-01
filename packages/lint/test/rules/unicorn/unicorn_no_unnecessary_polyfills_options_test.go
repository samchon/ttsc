package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsAcceptsUpstreamSchemaShapes verifies the
// option decoder accepts exactly the shapes upstream's JSON schema allows: an
// omitted option, an empty object, an absent `targets`, and a `targets`
// that is a query string, an array of queries, or a targets object.
//
// A decoder that rejected a legal shape would break real configs; the negative
// twin (illegal shapes) is owned by TestUnicornNoUnnecessaryPolyfillsRejectsMalformedOptions
// in a sibling file; this test asserts only the legal shapes.
//
//  1. Build an engine with each legal options payload.
//  2. Assert no ConfigError is raised.
// @evidence contracts/testing.md#behavioral-verification Real engine construction accepts each legal options shape with nil ConfigError, detecting rejection of supported configuration.
// @evidence contracts/testing.md#independent-expectations The supported targets schema independently permits omitted options, an empty object, a query string, a query array and a target map.
// @evidence contracts/testing.md#distinguishing-cases The five legal shapes contrast with RejectsMalformedOptions, which owns nonobject outer options, unknown keys and unsupported target primitive values.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsAcceptsUpstreamSchemaShapes owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsAcceptsUpstreamSchemaShapes(t *testing.T) {
  legal := []string{
    ``,
    `{}`,
    `{"targets":"node 8"}`,
    `{"targets":["node 8","chrome 100"]}`,
    `{"targets":{"node":"8"}}`,
  }
  for _, options := range legal {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornNoUnnecessaryPolyfillsRuleName: SeverityError},
      Options: RuleOptionsMap{unicornNoUnnecessaryPolyfillsRuleName: json.RawMessage(options)},
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("legal options %q raised ConfigError: %v", options, err)
    }
  }
}
