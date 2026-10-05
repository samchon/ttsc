package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatCommandResolverVariantsReplaceBareOptionsWithReachableDefaults
// verifies eager validation stays aligned with runtime binding.
//
// A nil inner payload is not reachable when the format command supplies a
// synthetic default, so RuleOptionsVariants must return the default alone.
//
//  1. Build a resolver whose inner config disables format/semi and whose
//     default options carry `{"prefer":"always"}`.
//  2. Ask for the option variants of format/semi.
//  3. Assert exactly the one default payload is returned.
//
// @evidence contracts/testing.md#behavioral-verification formatCommandResolver.RuleOptionsVariants must expose exactly the reachable always-semi default instead of a bare disabled inner payload.
// @evidence contracts/testing.md#independent-expectations The literal one-element JSON default is authored in the resolver fixture and is the only reachable command option by contract.
// @evidence contracts/testing.md#distinguishing-cases A disabled inner rule with configured command defaults exercises replacement; the matching-entry sibling checks scoped runtime tuples.
// @evidence contracts/testing.md#execution-ownership TestFormatCommandResolverVariantsReplaceBareOptionsWithReachableDefaults is a public format unit selected by the lint semantic-unit Evidence claim. It calls the resolver directly on authored entries in the shared Go process, without consumer installation, building a native product artifact or starting a product host.
func TestFormatCommandResolverVariantsReplaceBareOptionsWithReachableDefaults(t *testing.T) {
  resolver := formatCommandResolver{
    inner: RuleConfig{"format/semi": SeverityOff},
    defaultOptions: RuleOptionsMap{
      "format/semi": json.RawMessage(`{"prefer":"always"}`),
    },
  }
  variants := resolver.RuleOptionsVariants("format/semi")
  if len(variants) != 1 || string(variants[0]) != `{"prefer":"always"}` {
    t.Fatalf("validation variants do not match reachable defaults: %q", variants)
  }
}
