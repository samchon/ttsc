package linthost

import "testing"

// TestRuleCorpusUnicornNoEmptyFile verifies unicorn/no-empty-file reports a
// file whose only statement is a bare `;` empty-statement.
//
// The rule visits the `KindSourceFile` dispatch slot once per file and treats
// a statement list of all `EmptyStatement` nodes the same as a truly empty
// file. Reporting on the first statement (rather than file offset 0) keeps
// the diagnostic line stable for the corpus harness, which pins the expect
// comment to the next non-blank non-comment line.
//
// 1. Enable unicorn/no-empty-file via an expect annotation.
// 2. Use a single `;` as the file body.
// 3. Assert the empty statement is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an empty statement is the only non-comment file content; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-empty-file annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a value declaration makes the file nonempty. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoEmptyFile is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoEmptyFile(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-empty-file.ts", "// expect: unicorn/no-empty-file error\n;\n")
  assertRuleSkipsSource(t, "unicorn/no-empty-file", "export const value = 1;\n")
}
