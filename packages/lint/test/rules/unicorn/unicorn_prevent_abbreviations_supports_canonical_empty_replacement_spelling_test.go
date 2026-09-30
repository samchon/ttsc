package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsSupportsCanonicalEmptyReplacementSpelling verifies that the fixer compares an authored underscore binding/use result for an empty replacement.
//
// The supported empty candidate must still produce a valid binding name, independently requiring the canonical underscore.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares an authored underscore binding/use result for an empty replacement.
// @evidence contracts/testing.md#independent-expectations The supported empty candidate must still produce a valid binding name, independently requiring the canonical underscore.
// @evidence contracts/testing.md#distinguishing-cases Both original err identifiers become _ without altering surrounding source.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsSupportsCanonicalEmptyReplacementSpelling owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsSupportsCanonicalEmptyReplacementSpelling(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nvoid err;\n",
    `{"extendDefaultReplacements":false,"replacements":{"err":{"":true}}}`,
    "const _ = new Error();\nvoid _;\n",
  )
}
