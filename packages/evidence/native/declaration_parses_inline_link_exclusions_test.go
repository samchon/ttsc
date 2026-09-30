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
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations exercises this case: Verifies `@evidenceExclude` shares the grammar. The original assertions check assert both survive.
 * @evidence contracts/testing.md#independent-expectations The exclusion tag has the same target identity as `@evidence`, so a grammar that extended only the positive form would make an exclusion unable to name the very target it excludes. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Parse an exclusion whose target is an inline link. Read back the tag kind and the target. Assert both survive. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationParsesInlineLinkExclusions is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls parseDeclarations within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
