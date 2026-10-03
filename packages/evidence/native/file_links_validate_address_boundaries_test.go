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
 *
 * @evidence contracts/testing.md#behavioral-verification splitDeclarationBody is called on three file-link bodies (an encoded path with a quoted `"a b"` accessor, a numeric `[12]` accessor and a quoted accessor with a backslash) and must return display targets `a%20%23%25.ts#C["a b"].run`, `a.ts#C["12"]` and `a.ts#C["x\\y"]` with the reason `Because it applies.`; parseFileLink must return a problem for each of twelve malformed targets (empty, no fragment, no path, empty fragment, bad and NUL escapes, trailing dot, empty and zero-padded brackets, an unterminated quote, a dot before a bracket, trailing text after a bracket).
 * @evidence contracts/testing.md#independent-expectations The expected canonical targets and the enumerated malformed list are authored from the address grammar: quoted and numeric segments keep their meaning and the whole reason, and a malformed or truncated accessor must never be guessed into a different unit.
 * @evidence contracts/testing.md#distinguishing-cases Three valid spellings against twelve malformed ones: the valid rows check the split between target and reason, the malformed rows only check that a problem is returned, not its wording.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksValidateAddressBoundaries is a Go unit entry in the native test process that loops over two tables (not named subtests); it calls splitDeclarationBody and parseFileLink on in-memory strings with no filesystem, consumer install or product host.
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
