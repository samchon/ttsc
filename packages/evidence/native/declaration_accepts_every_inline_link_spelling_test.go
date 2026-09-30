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
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations exercises this case: Verifies every inline link spelling opens a target. The original assertions check assert all three resolve to the same symbol.
 * @evidence contracts/testing.md#independent-expectations `{@linkcode}` and `{@linkplain}` resolve names exactly as `{@link}` does, so accepting only the shortest spelling would reject a citation TypeScript is perfectly happy to count as a use. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Parse each supported inline link spelling. Read back each target. Assert all three resolve to the same symbol. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationAcceptsEveryInlineLinkSpelling is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls parseDeclarations within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
