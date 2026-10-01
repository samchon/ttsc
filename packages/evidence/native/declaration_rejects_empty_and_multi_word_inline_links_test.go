package evidence

import "testing"

/**
 * Verifies an empty or multi-word link interior is not a target.
 *
 * `{@link }` names nothing and `{@link A B}` names two things, and a target
 * identity that accepted either would resolve against a symbol name containing
 * a space, which no declaration can have.
 *
 *  1. Parse an empty link and a two-word link.
 *  2. Read back each target.
 *  3. Assert neither becomes an inline link target.
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations is called on `{@link }` and `{@link ISale IShoppingSale}` comments; for each, if exactly one declaration is returned its target must not be an inline link target.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the grammar contract: an empty interior names nothing and a two-word interior names two things, so neither may become a target that would be resolved as a symbol name containing a space.
 * @evidence contracts/testing.md#distinguishing-cases An empty link and a two-word link, looped as plain iterations; the assertion is conditional on a single declaration being returned, so a parser that returns no declaration also passes, and the well-formed spellings are owned by a sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationRejectsEmptyAndMultiWordInlineLinks is a Go unit entry in the native test process; it calls parseDeclarations on in-memory comment strings with no filesystem, consumer install or product host.
 */
func TestDeclarationRejectsEmptyAndMultiWordInlineLinks(t *testing.T) {
  for _, comment := range []string{
    "/** @evidence {@link } Mirrors the contract. */",
    "/** @evidence {@link ISale IShoppingSale} Mirrors the contract. */",
  } {
    parsed := parseDeclarations(comment)
    if len(parsed) == 1 && isInlineLinkTarget(parsed[0].Target) {
      t.Fatalf("comment %q became an inline link target", comment)
    }
  }
}
