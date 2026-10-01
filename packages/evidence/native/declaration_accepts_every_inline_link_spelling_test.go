package evidence

import "testing"

/**
 * Verifies every inline link spelling opens a target.
 *
 * `{@linkcode}` and `{@linkplain}` resolve names exactly as `{@link}` does, so
 * accepting only the shortest spelling would reject a citation TypeScript is
 * perfectly happy to count as a use.
 *
 *  1. Parse each supported inline link spelling.
 *  2. Read back each target.
 *  3. Assert all three resolve to the same symbol.
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations is called on three one-line comments citing `{@link ISale}`, `{@linkcode ISale}` and `{@linkplain ISale}`; for each it must return exactly one declaration whose inlineLinkTarget is `ISale`.
 * @evidence contracts/testing.md#independent-expectations The expected target is the authored symbol name: the three spellings resolve a name identically, so accepting only `{@link}` would reject citations TypeScript counts as uses.
 * @evidence contracts/testing.md#distinguishing-cases Three supported spellings of the same braced target, looped as plain iterations; the malformed, empty and unterminated spellings are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationAcceptsEveryInlineLinkSpelling is a Go unit entry in the native test process; it calls parseDeclarations on in-memory comment strings with no filesystem, consumer install or product host.
 */
func TestDeclarationAcceptsEveryInlineLinkSpelling(t *testing.T) {
  for _, comment := range []string{
    "/** @evidence {@link ISale} Mirrors the contract. */",
    "/** @evidence {@linkcode ISale} Mirrors the contract. */",
    "/** @evidence {@linkplain ISale} Mirrors the contract. */",
  } {
    parsed := parseDeclarations(comment)
    if len(parsed) != 1 || inlineLinkTarget(parsed[0].Target) != "ISale" {
      t.Fatalf("comment %q parsed as %+v", comment, parsed)
    }
  }
}
