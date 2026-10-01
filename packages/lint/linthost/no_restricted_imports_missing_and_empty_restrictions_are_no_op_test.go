package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsMissingAndEmptyRestrictionsAreNoOp verifies the rule
// reports nothing when its options are absent or restrict nothing.
//
// The Test runs one source that imports lodash, re-exports from underscore and
// imports node:fs once for each of six option values: no options, `{}`, `[]`,
// `{"paths":[]}`, `{"patterns":[]}` and `{"paths":[],"patterns":[]}`.
//
// 1. Run the rule with each option value over the source.
// 2. Require zero findings for every value.
//
// @evidence contracts/testing.md#behavioral-verification For each of the six option values the rule produces no finding for the lodash import, the underscore reexport and the node:fs import, so the rule has no built-in policy of its own.
// @evidence contracts/testing.md#independent-expectations With nothing configured nothing is restricted, so every authored import is allowed; the zero expectation is a literal that follows from that contract, and the six option values are authored literals.
// @evidence contracts/testing.md#distinguishing-cases The six option values cover missing options, an empty object, an empty array, empty paths, empty patterns and both empty. They are all negative cases; the reporting counterparts live in the sibling no-restricted-imports Tests.
// @evidence contracts/testing.md#execution-ownership A loop over the six option values calls runNoRestrictedImports, which calls runRuleFindingsSnapshot (binding the rule at error severity, so an invalid option would fail the Test) and runs Engine.Run in the Go test process. The Test asserts the zero-length result for each iteration.
func TestNoRestrictedImportsMissingAndEmptyRestrictionsAreNoOp(t *testing.T) {
  source := `import lodash from "lodash";
export { map } from "underscore";
import * as fs from "node:fs";
void lodash;
void fs;
`
  options := []json.RawMessage{
    nil,
    json.RawMessage(`{}`),
    json.RawMessage(`[]`),
    json.RawMessage(`{"paths":[]}`),
    json.RawMessage(`{"patterns":[]}`),
    json.RawMessage(`{"paths":[],"patterns":[]}`),
  }
  for _, option := range options {
    if findings := runNoRestrictedImports(t, source, option); len(findings) != 0 {
      t.Fatalf("empty options %s inferred a restriction: %+v", option, findings)
    }
  }
}
