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
