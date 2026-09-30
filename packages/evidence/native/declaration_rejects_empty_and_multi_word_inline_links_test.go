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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseDeclarations exercises this case: Verifies an empty or multi-word link interior is not a target. The original assertions check assert neither becomes an inline link target.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `{@link }` names nothing and `{@link A B}` names two things, and a target identity that accepted either would resolve against a symbol name containing a space, which no declaration can have. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Parse an empty link and a two-word link. Read back each target. Assert neither becomes an inline link target. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDeclarationRejectsEmptyAndMultiWordInlineLinks is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls parseDeclarations within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
