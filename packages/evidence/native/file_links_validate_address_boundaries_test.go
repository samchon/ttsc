package evidence

import "testing"

/**
 * Verifies file-address grammar distinguishes quoted segments from reason text.
 *
 * A malformed or truncated accessor must not be guessed into a different unit.
 * Encoded path characters and literal member characters have separate rules.
 *
 * 1. Parse escaped file paths and quoted/numeric accessor segments.
 * 2. Verify canonical targets keep the complete reason.
 * 3. Reject malformed paths, escapes, separators, and brackets.
 */
func TestFileLinksValidateAddressBoundaries(t *testing.T) {
  for _, test := range []struct{ input, target string }{
    {`./a%20%23%25.ts#C["a b"].run Because it applies.`, `a%20%23%25.ts#C["a b"].run`},
    {`a.ts#C[12] Because it applies.`, `a.ts#C["12"]`},
    {`a.ts#C["x\\y"] Because it applies.`, `a.ts#C["x\\y"]`},
  } {
    target, reason := splitDeclarationBody(fileLinkPrefix + test.input)
    if displayTarget(target) != test.target || reason != "Because it applies." {
      t.Fatalf("split %q: %q, %q", test.input, target, reason)
    }
  }
  for _, target := range []string{"", "a.ts", "#C", "a.ts#", "a%xx.ts#C", "a%00.ts#C", "a.ts#C.", "a.ts#C[]", "a.ts#C[01]", "a.ts#C[\"unterminated]", "a.ts#C.[\"x\"]", "a.ts#C[\"x\"]suffix"} {
    if _, problem := parseFileLink(target); problem == "" {
      t.Fatalf("accepted malformed target %q", target)
    }
  }
}
