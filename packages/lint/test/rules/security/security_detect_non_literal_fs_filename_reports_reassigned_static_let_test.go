package linthost

import "testing"

// TestSecurityDetectNonLiteralFSFilenameReportsReassignedStaticLet verifies security rule: reassigned literals are dynamic.
//
// A `let` declaration with a literal initializer is only safe while its binding
// stays stable. This pins the branch that removes reassigned locals from the
// static-expression table before filesystem filename checks consult it.
//
// 1. Import `fs` and initialize a `let` filename with a string literal.
// 2. Reassign that filename from a non-literal input.
// 3. Assert `readFileSync(filename)` is reported as non-literal.
//
// @evidence contracts/testing.md#behavioral-verification The filesystem rule invalidates a literal initializer after filename is reassigned to dynamic input before readFileSync.
// @evidence contracts/testing.md#independent-expectations The explicit assignment destroys the independently known constant-path premise; the fixture expects one finding at the use, not at initialization.
// @evidence contracts/testing.md#distinguishing-cases Contrasts initial literal provenance with later mutation; TestSecurityDetectNonLiteralFSFilename owns stable literal versus identifier calls, and the assertion-wrapped sibling owns TS target wrappers.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectNonLiteralFSFilenameReportsReassignedStaticLet(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-non-literal-fs-filename-reassigned-static-let.ts", `
import fs from "fs";
let filename = "./safe.json";
filename = input;
// expect: security/detect-non-literal-fs-filename error
fs.readFileSync(filename);
`)
}
