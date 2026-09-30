package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsRenamesMergedTypeAndValueReferencesTogether verifies that actual fix execution compares an authored merged interface/value/default-export output.
//
// A merged type/value declaration independently shares one identity and must rename both namespaces consistently.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution compares an authored merged interface/value/default-export output.
// @evidence contracts/testing.md#independent-expectations A merged type/value declaration independently shares one identity and must rename both namespaces consistently.
// @evidence contracts/testing.md#distinguishing-cases Interface, const annotation/value and default export Prop all become Property.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsRenamesMergedTypeAndValueReferencesTogether owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsRenamesMergedTypeAndValueReferencesTogether(t *testing.T) {
  source := "interface Prop {\n  id: number;\n}\nconst Prop: Prop = { id: 1 };\nexport default Prop;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "interface Property {\n  id: number;\n}\nconst Property: Property = { id: 1 };\nexport default Property;\n",
  )
}
