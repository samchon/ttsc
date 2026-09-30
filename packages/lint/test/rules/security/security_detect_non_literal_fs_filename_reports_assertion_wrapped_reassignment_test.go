package linthost

import "testing"

// TestSecurityDetectNonLiteralFSFilenameReportsAssertionWrappedReassignment
// verifies the shared text projection invalidates a previously static binding
// after a TypeScript assertion-wrapped write.
//
// @evidence contracts/testing.md#behavioral-verification The filesystem rule stops treating filename as static after an assertion-wrapped write replaces its literal initializer with input.
// @evidence contracts/testing.md#independent-expectations A reassigned let binding no longer guarantees the literal safe.json path; the authored marker requires a finding at the read sink.
// @evidence contracts/testing.md#distinguishing-cases Pins the TypeScript assertion wrapper around the assignment target; plain reassignment is owned by TestSecurityDetectNonLiteralFSFilenameReportsReassignedStaticLet and untouched literals by TestSecurityDetectNonLiteralFSFilename.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectNonLiteralFSFilenameReportsAssertionWrappedReassignment(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-non-literal-fs-filename-assertion-write.ts", `
import fs from "fs";
let filename = "./safe.json";
(filename as string) = input;
// expect: security/detect-non-literal-fs-filename error
fs.readFileSync(filename);
`)
}
