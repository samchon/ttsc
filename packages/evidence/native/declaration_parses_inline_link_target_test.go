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
 *
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations is called on `/** @evidence {@link api.functional.questions.get} Renders this operation. *\/`; it must return one declaration whose target is an inline link target with interior `api.functional.questions.get` and whose Reason is `Renders this operation.`.
 * @evidence contracts/testing.md#independent-expectations The expected target and reason are authored literals from the braced-grammar contract: an inline link target is consumed through its closing brace, so the symbol name must not leak into the reason.
 * @evidence contracts/testing.md#distinguishing-cases One dotted inline-link target followed by prose: a whitespace-delimited parse would stop at `{@link` and leave the name in the reason, failing both the target and the reason checks. Spelling variants and malformed links are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationParsesInlineLinkTarget is a Go unit entry in the native test process; it calls parseDeclarations on one in-memory comment string with no filesystem, consumer install or product host.
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
