package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessIteratorToArray verifies
// unicorn/no-useless-iterator-to-array reports `[...arr.entries()]` inside a
// `for…of` head.
//
// The rule's syntactic match is the array-literal/spread/iterator-call
// container; the surrounding `for…of` is realistic context but not part of
// the predicate, so this fixture pins the smallest expression shape and the
// `entries` branch of the iterator-method switch.
//
// 1. Enable unicorn/no-useless-iterator-to-array via an expect annotation.
// 2. Iterate `[...arr.entries()]` with a `for…of` loop.
// 3. Assert the outer array literal is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies for-of materializes the entries iterator as an array first; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-useless-iterator-to-array annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; for-of consumes the same entries iterator directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUselessIteratorToArray is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUselessIteratorToArray(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-iterator-to-array.ts", "const arr = [1, 2];\n// expect: unicorn/no-useless-iterator-to-array error\nfor (const e of [...arr.entries()]) { void e; }\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-iterator-to-array", "const arr = [1,2]; for (const e of arr.entries()) { void e; }\n")
}
