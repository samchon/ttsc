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
func TestRuleCorpusUnicornNoEmptyFile(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-empty-file.ts", "// expect: unicorn/no-empty-file error\n;\n")
}
