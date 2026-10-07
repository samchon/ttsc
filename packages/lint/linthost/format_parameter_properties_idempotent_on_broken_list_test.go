package linthost

import "testing"

// TestFormatParameterPropertiesIdempotentOnBrokenList verifies the rule
// abstains once the parameter list is already multi-line.
//
// The literal already-broken list contains a newline in the `(...)` region
// and a final comma. This dedicated rule must leave it to the multiline
// layout owners; the no-finding body does not certify cascade convergence.
//
//  1. Parse a class whose parameter-property constructor is already
//     broken one-per-line.
//  2. Run format/parameter-properties.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning parameter-properties rule must report nothing for an already broken two-property list. The absence assertion prevents rebuilding a canonical multiline list and fighting the sibling trailing-comma decision.
// @evidence contracts/testing.md#independent-expectations The supported rule only force-breaks flat lists; this literal input is already multiline and includes its independently valid trailing comma. Keeping its bytes unchanged is required without recomputing a printer output.
// @evidence contracts/testing.md#distinguishing-cases This canonical multiline negative complements BreaksMultiParamConstructor, whose flat list must change. Singleton and plain-parameter hosts cover other reasons to abstain.
// @evidence contracts/testing.md#execution-ownership TestFormatParameterPropertiesIdempotentOnBrokenList owns its complete no-finding fixture in the public Go unit population. The syntax-only owning operation runs in process without installing a consumer, building native artifacts or starting a real product host.
func TestFormatParameterPropertiesIdempotentOnBrokenList(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/parameter-properties",
    "class A {\n  constructor(\n    private x: Foo,\n    public y: Bar,\n  ) {}\n}\n",
    `{"tabWidth":2}`,
  )
}
