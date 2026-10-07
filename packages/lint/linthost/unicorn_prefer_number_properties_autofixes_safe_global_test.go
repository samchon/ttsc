package linthost

import (
  "testing"
)

// TestUnicornPreferNumberPropertiesAutofixesSafeGlobal proves a pure-alias
// global carries an automatic fix.
//
// 1. Run the authored global parseInt fixture under default options through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification The owning fix pipeline rewrites the global numeric helper and compares the entire authored output, detecting missing edits or edits to unrelated source.
// @evidence contracts/testing.md#independent-expectations The supported Number-qualified replacement for the safe global helper establishes the literal full-source output independently of the fixer.
// @evidence contracts/testing.md#distinguishing-cases The original transform input must change exactly as authored; TestRuleCorpusUnicornPreferNumberProperties separately retains shadowed parseInt no-action controls.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesAutofixesSafeGlobal owns this literal parseInt fixture as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesAutofixesSafeGlobal(t *testing.T) {
  assertFixSnapshot(
    t,
    unicornPreferNumberPropertiesRuleName,
    "export {};\nconst raw = \"10\";\nconst n = parseInt(raw, 2);\nvoid n;\n",
    "export {};\nconst raw = \"10\";\nconst n = Number.parseInt(raw, 2);\nvoid n;\n",
  )
}
