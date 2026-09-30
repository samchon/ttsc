package evidence

import "testing"

/**
 * Verifies an unterminated link is malformed rather than silently retargeted.
 *
 * Falling back to whitespace splitting would produce the target `{@link`, whose
 * diagnostic names a symbol nobody wrote. Leaving it to the malformed-
 * declaration path reports the tag the author actually typed.
 *
 *  1. Parse a tag whose inline link is never closed.
 *  2. Read back the target.
 *  3. Assert it is not an inline link target.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseDeclarations exercises this case: Verifies an unterminated link is malformed rather than silently retargeted. The original assertions check assert it is not an inline link target.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Falling back to whitespace splitting would produce the target `{@link`, whose diagnostic names a symbol nobody wrote. Leaving it to the malformed- declaration path reports the tag the author actually typed. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Parse a tag whose inline link is never closed. Read back the target. Assert it is not an inline link target. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDeclarationRejectsUnterminatedInlineLinks is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls parseDeclarations within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDeclarationRejectsUnterminatedInlineLinks(t *testing.T) {
  parsed := parseDeclarations("/** @evidence {@link ISale Mirrors the contract. */")
  if len(parsed) != 1 {
    t.Fatalf("parsed as %+v", parsed)
  }
  if isInlineLinkTarget(parsed[0].Target) {
    t.Fatalf("an unterminated link became a link target: %q", parsed[0].Target)
  }
}
