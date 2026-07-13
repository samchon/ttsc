package linthost

import "testing"

// TestSecurityDetectNonLiteralFSFilenameReportsAssertionWrappedReassignment
// verifies the shared text projection invalidates a previously static binding
// after a TypeScript assertion-wrapped write.
func TestSecurityDetectNonLiteralFSFilenameReportsAssertionWrappedReassignment(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-non-literal-fs-filename-assertion-write.ts", `
import fs from "fs";
let filename = "./safe.json";
(filename as string) = input;
// expect: security/detect-non-literal-fs-filename error
fs.readFileSync(filename);
`)
}
