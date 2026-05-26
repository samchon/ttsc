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
func TestSecurityDetectNonLiteralFSFilenameReportsReassignedStaticLet(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-non-literal-fs-filename-reassigned-static-let.ts", `
import fs from "fs";
let filename = "./safe.json";
filename = input;
// expect: security/detect-non-literal-fs-filename error
fs.readFileSync(filename);
`)
}
