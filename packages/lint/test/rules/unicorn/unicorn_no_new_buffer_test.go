package linthost

import "testing"

// TestRuleCorpusUnicornNoNewBuffer verifies unicorn/no-new-buffer reports
// `new Buffer(...)` constructions.
//
// This fixture pins the identifier-text branch on the most common argument
// shape — an integer size literal — and locks the contract that argument
// arity and type are not part of the match. The rule reports purely on the
// callee identifier text, mirroring `promise/avoid-new`'s `identifierText`
// gate against the constructor name.
//
// 1. Enable unicorn/no-new-buffer via an expect annotation.
// 2. Construct `new Buffer(10)` at the top level.
// 3. Assert the new-expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies the deprecated new Buffer constructor creates a buffer; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-new-buffer annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Buffer.alloc explicitly creates the same-size buffer. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoNewBuffer is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoNewBuffer(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-new-buffer.ts", "// expect: unicorn/no-new-buffer error\nconst b = new Buffer(10);\n")
  assertRuleSkipsSource(t, "unicorn/no-new-buffer", "const b = Buffer.alloc(10);\n")
}
