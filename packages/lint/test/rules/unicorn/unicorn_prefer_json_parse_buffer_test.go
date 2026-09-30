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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies JSON.parse receives an unnecessary Buffer toString conversion; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-json-parse-buffer annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; JSON.parse receives the buffer directly under the supported policy. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferJsonParseBuffer is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferJsonParseBuffer(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-json-parse-buffer.ts", "declare const buf: Buffer;\n// expect: unicorn/prefer-json-parse-buffer error\nconst data = JSON.parse(buf.toString());\nvoid data;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-json-parse-buffer", "declare const buf: Buffer; const data = JSON.parse(buf);\n")
}
