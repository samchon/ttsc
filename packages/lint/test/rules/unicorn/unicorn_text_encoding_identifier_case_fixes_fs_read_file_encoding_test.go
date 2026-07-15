package linthost

import "testing"

// TestUnicornTextEncodingIdentifierCaseFixesFsReadFileEncoding verifies the
// encoding argument of `fs.readFile` / `fs.readFileSync` is autofixed in place —
// the single position upstream marks fixable rather than a suggestion.
//
// The match requires the literal to be the SECOND argument of a non-optional
// `.readFile`/`.readFileSync` member call, so the fix rewrites `"UTF-8"` to the
// canonical `"utf8"` while preserving the quotes and every other argument.
//
//  1. Declare an fs-shaped object and call readFile/readFileSync with a
//     non-canonical encoding.
//  2. Run the rule through the native fix applier.
//  3. Assert the encoding argument is rewritten and nothing else moves.
func TestUnicornTextEncodingIdentifierCaseFixesFsReadFileEncoding(t *testing.T) {
  declare := "declare const fs: { readFile(p: string, e: string, cb: () => void): void; readFileSync(p: string, e: string): string };\n"
  for _, testCase := range []struct {
    source   string
    expected string
  }{
    {
      source:   declare + "fs.readFile(\"file.txt\", \"UTF-8\", () => {});\n",
      expected: declare + "fs.readFile(\"file.txt\", \"utf8\", () => {});\n",
    },
    {
      source:   declare + "const text = fs.readFileSync(\"file.txt\", \"ASCII\");\nvoid text;\n",
      expected: declare + "const text = fs.readFileSync(\"file.txt\", \"ascii\");\nvoid text;\n",
    },
  } {
    assertFixSnapshot(
      t,
      unicornTextEncodingIdentifierCaseRuleName,
      testCase.source,
      testCase.expected,
    )
  }
}
