package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsAcceptsUpstreamSchemaShapes verifies the
// native decoder accepts these five authored payloads: an omitted option,
// an empty object, a targets query string, an array of queries and a target
// map. This acceptance test does not establish exhaustive schema validation
// or rejection of other payloads.
//
//  1. Build an engine with each legal options payload.
//  2. Assert no ConfigError is raised.
//
// @evidence contracts/testing.md#behavioral-verification Real engine construction accepts each legal options shape with nil ConfigError, detecting rejection of supported configuration.
// @evidence contracts/testing.md#independent-expectations The supported targets schema independently permits omitted options, an empty object, a query string, a query array and a target map.
// @evidence contracts/testing.md#distinguishing-cases Omitted options and an empty object distinguish defaults from explicit string, array and map target payloads.
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
