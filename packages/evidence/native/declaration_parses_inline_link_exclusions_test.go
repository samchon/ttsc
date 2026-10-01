package evidence

import "testing"

/**
 * Verifies `@evidenceExclude` shares the grammar.
 *
 * The exclusion tag has the same target identity as `@evidence`, so a grammar
 * that extended only the positive form would make an exclusion unable to name
 * the very target it excludes.
 *
 *  1. Parse an exclusion whose target is an inline link.
 *  2. Read back the tag kind and the target.
 *  3. Assert both survive.
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations is called on `/** @evidenceExclude {@link ISale} This screen intentionally omits it. *\/`; it must return exactly one declaration whose Tag is the exclusion tag and whose inlineLinkTarget is `ISale`.
 * @evidence contracts/testing.md#independent-expectations The expected tag and target are authored: the exclusion tag shares the target grammar with `@evidence`, so an exclusion must be able to name an inline link target.
 * @evidence contracts/testing.md#distinguishing-cases One exclusion with a braced target; the same grammar for the positive tag is covered by sibling entries, so this entry owns the exclusion tag kind.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationParsesInlineLinkExclusions is a Go unit entry in the native test process; it calls parseDeclarations on one in-memory comment string with no filesystem, consumer install or product host.
 */
func TestDeclarationParsesInlineLinkExclusions(t *testing.T) {
  parsed := parseDeclarations(
    "/** @evidenceExclude {@link ISale} This screen intentionally omits it. */",
  )
  if len(parsed) != 1 || parsed[0].Tag != tagExclude {
    t.Fatalf("parsed as %+v", parsed)
  }
  if inlineLinkTarget(parsed[0].Target) != "ISale" {
    t.Fatalf("target: %q", inlineLinkTarget(parsed[0].Target))
  }
}
