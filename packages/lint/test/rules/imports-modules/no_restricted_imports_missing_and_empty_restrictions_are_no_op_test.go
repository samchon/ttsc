package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsMissingAndEmptyRestrictionsAreNoOp verifies Engine restricts no module when options are missing or empty, instead of inferring policy from ordinary import names.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification Engine restricts no module when options are missing or empty, instead of inferring policy from ordinary import names.
// @evidence contracts/testing.md#independent-expectations The supported absence of a restriction permits every authored lodash, underscore and node:fs operation; six literal empty representations establish the zero oracle.
// @evidence contracts/testing.md#distinguishing-cases Missing options, empty object/array, empty paths, empty patterns and both empty populations retain distinct decoding inputs.
// @evidence contracts/testing.md#execution-ownership Each of the six authored empty option values is passed to runNoRestrictedImports, which calls runRuleFindingsSnapshot and validates returned ranges and absence of edits. This Test entry owns every direct zero-finding comparison in its loop; no consumer installation or product-host process runs.
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
