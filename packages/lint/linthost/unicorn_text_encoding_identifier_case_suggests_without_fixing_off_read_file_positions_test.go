package linthost

import "testing"

// TestUnicornTextEncodingIdentifierCaseSuggestsWithoutFixingOffReadFilePositions
// verifies every position OTHER than the encoding argument of a plain
// `.readFile`/`.readFileSync` call reports a finding but is not autofixed —
// the fix cascade applies zero edits and the source is left untouched.
//
// Each case is a twin of the autofixed position exactly one property away: a
// neutral literal, the readFile PATH argument (index 0, not the encoding), an
// optional call (`readFile?.()`), an optional member (`fs?.readFile()`), and a
// leading spread (which shifts the encoding out of the fixable slot). All still
// report because upstream checks every string literal; only the plain
// second-argument form is fixable.
//
//  1. Lint a non-canonical encoding literal outside the fixable position.
//  2. Run it through the native fix applier.
//  3. Assert at least one finding but zero applied edits and unchanged source.
//
// @evidence contracts/testing.md#behavioral-verification assertNoFixSnapshot requires a diagnostic, zero applied edits and byte-identical source for five nonfixable positions.
// @evidence contracts/testing.md#independent-expectations The original authored source is the no-edit oracle; upstream restricts automatic fixes to plain second-argument readFile/readFileSync positions.
// @evidence contracts/testing.md#distinguishing-cases Neutral literal, path argument, optional call, optional receiver and preceding spread still report without edits; TestUnicornTextEncodingIdentifierCaseFixesFsReadFileEncoding owns qualifying positive positions. This entry does not independently assert suggestion title or edit contents.
// @evidence contracts/testing.md#execution-ownership TestUnicornTextEncodingIdentifierCaseSuggestsWithoutFixingOffReadFilePositions is a discoverable Go unit host; its source/option fixtures exercise owning AST engine and fix operations in the shared Go process without consumer installation, native builds or product child hosts. Helper failures retain the source/expected fixture identity.
func TestUnicornTextEncodingIdentifierCaseSuggestsWithoutFixingOffReadFilePositions(t *testing.T) {
  fsDeclare := "declare const fs: any;\ndeclare const args: string[];\n"
  for _, source := range []string{
    "const enc = \"utf-8\";\nvoid enc;\n",
    fsDeclare + "fs.readFile(\"UTF-8\", () => {});\n",
    fsDeclare + "fs.readFile?.(\"file.txt\", \"UTF-8\", () => {});\n",
    fsDeclare + "fs?.readFile(\"file.txt\", \"UTF-8\", () => {});\n",
    fsDeclare + "fs.readFile(...args, \"UTF-8\", () => {});\n",
  } {
    assertNoFixSnapshot(t, unicornTextEncodingIdentifierCaseRuleName, source)
  }
}
