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
 *
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations is called on `/** @evidence {@link ISale Mirrors the contract. *\/` (the link is never closed); it must return exactly one declaration whose target is not an inline link target.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the grammar contract: an unterminated link must be left to the malformed-declaration path rather than being retargeted by whitespace splitting into the target `{@link`.
 * @evidence contracts/testing.md#distinguishing-cases One unterminated link against the well-formed spellings of sibling entries; only the target kind is asserted, not the target text or the reason, so the exact fallback value is not pinned.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationRejectsUnterminatedInlineLinks is a Go unit entry in the native test process; it calls parseDeclarations on one in-memory comment string with no filesystem, consumer install or product host.
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
