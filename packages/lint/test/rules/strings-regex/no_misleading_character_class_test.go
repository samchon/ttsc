package linthost

import "testing"

// TestRuleCorpusNoMisleadingCharacterClass verifies the lint rule corpus fixture no-misleading-character-class.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-misleading-character-class.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports the astral thumbs-up inside a legacy regex class while permitting an ASCII class.
// @evidence contracts/testing.md#independent-expectations Without Unicode mode the authored surrogate pair is two class members rather than one code point; the literal annotated diagnostic follows that regex meaning.
// @evidence contracts/testing.md#distinguishing-cases Astral legacy member versus ASCII member distinguishes surrogate ambiguity from all character classes.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource executes the newly authored neighboring clean source. Both invocations belong to this discoverable Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusNoMisleadingCharacterClass(t *testing.T) {
  assertRuleCorpusCase(t, "no-misleading-character-class.ts", "// expect: no-misleading-character-class error\nconst r = /[👍]/;\nJSON.stringify(r);\n")
  assertRuleSkipsSource(t, "no-misleading-character-class", "const re = /[abc]/;\n")
}
