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
func TestSecurityDetectNonLiteralFSFilename(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-non-literal-fs-filename.ts", `
import fs from "fs";
fs.readFileSync("./safe.json");
// expect: security/detect-non-literal-fs-filename error
fs.readFileSync(filename);
`)
}
