package linthost

import "testing"

// TestRuleCorpusUnicornPreferJsonParseBuffer verifies the rule reports
// `JSON.parse(buf.toString())` on a declared Buffer.
//
// The rule keys purely on the syntactic shape — outer call is
// `JSON.parse` and the single argument is an inner `.toString()` call
// with no arguments. Receiver typing is out of scope; a declared
// `Buffer` binding is the smallest legible positive shape and matches
// the canonical Node-21+ optimization target.
//
// 1. Enable unicorn/prefer-json-parse-buffer via an expect annotation.
// 2. Call `JSON.parse(buf.toString())` on a declared Buffer binding.
// 3. Assert the outer call is reported.
func TestRuleCorpusUnicornPreferJsonParseBuffer(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-json-parse-buffer.ts", "declare const buf: Buffer;\n// expect: unicorn/prefer-json-parse-buffer error\nconst data = JSON.parse(buf.toString());\nvoid data;\n")
}
