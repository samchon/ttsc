package linthost

import "testing"

// TestSecurityDetectNonLiteralFSFilename verifies security rule: fs filename arguments stay literal.
//
// The rule tracks an imported fs namespace and reports filesystem APIs whose path
// argument is not statically known.
//
// 1. Import `fs`.
// 2. Call `readFileSync` with a literal and with a variable.
// 3. Assert only the variable filename is reported.
//
// @evidence contracts/testing.md#behavioral-verification The filesystem rule reports imported fs.readFileSync(filename) while leaving the same API with safe.json literal alone.
// @evidence contracts/testing.md#independent-expectations Authored marker lines express the supported non-literal filename policy, with exact rule and severity checks independent of engine output.
// @evidence contracts/testing.md#distinguishing-cases Literal and identifier paths on the same imported namespace distinguish valid static input from dynamic input; reassignment has separate plain and assertion-wrapped cases.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectNonLiteralFSFilename(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-non-literal-fs-filename.ts", `
import fs from "fs";
fs.readFileSync("./safe.json");
// expect: security/detect-non-literal-fs-filename error
fs.readFileSync(filename);
`)
}
