package evidence

import "testing"

/**
 * Verifies the braced grammar: an inline link target is consumed through its
 * closing brace, and the prose after it is the reason.
 *
 * A whitespace-delimited token would stop at `{@link`, leaving the symbol name
 * in the reason and reporting a repair the author cannot make. The brace is the
 * boundary that a code target needs and a path target never did.
 *
 *  1. Parse an `@evidence` tag whose target is an inline link.
 *  2. Read back the target and the reason.
 *  3. Assert the interior is the target and the rest is the reason.
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations exercises this case: Verifies the braced grammar: an inline link target is consumed through its closing brace, and the prose after it is the reason. The original assertions check assert the interior is the target and the rest is the reason.
 * @evidence contracts/testing.md#independent-expectations A whitespace-delimited token would stop at `{@link`, leaving the symbol name in the reason and reporting a repair the author cannot make. The brace is the boundary that a code target needs and a path target never did. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Parse an `@evidence` tag whose target is an inline link. Read back the target and the reason. Assert the interior is the target and the rest is the reason. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationParsesInlineLinkTarget is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls parseDeclarations within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDeclarationParsesInlineLinkTarget(t *testing.T) {
  parsed := parseDeclarations(
    "/** @evidence {@link api.functional.questions.get} Renders this operation. */",
  )
  if len(parsed) != 1 {
    t.Fatalf("expected one declaration, got %d", len(parsed))
  }
  if !isInlineLinkTarget(parsed[0].Target) {
    t.Fatalf("expected an inline link target, got %q", parsed[0].Target)
  }
  if inlineLinkTarget(parsed[0].Target) != "api.functional.questions.get" {
    t.Fatalf("target: %q", inlineLinkTarget(parsed[0].Target))
  }
  if parsed[0].Reason != "Renders this operation." {
    t.Fatalf("reason: %q", parsed[0].Reason)
  }
}
