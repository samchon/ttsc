package evidence

import "testing"

/**
 * Verifies the two-token Swagger hazard does not recur through the brace path.
 *
 * `POST /members` must still parse as the target `POST` with the rest as its
 * reason, because the parser has no reference context to tell a Swagger path
 * from a TypeScript symbol named `POST`. The brace is what supplies a boundary
 * where one is genuinely needed.
 *
 *  1. Parse a space-separated Swagger-looking target.
 *  2. Read back the target.
 *  3. Assert the first token alone is the target.
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations is called on `/** @evidence POST /members Creates a member. *\/`; it must return one declaration whose Target is exactly `POST` and whose Reason is `/members Creates a member.`.
 * @evidence contracts/testing.md#independent-expectations The expected split is authored from the unbraced grammar contract: without braces the target is the first whitespace-delimited token, because the parser has no reference context to tell a Swagger path from a symbol named POST.
 * @evidence contracts/testing.md#distinguishing-cases The unbraced space-separated Swagger-looking form against the braced forms owned by sibling entries; a brace-path regression that consumed two tokens would change the target.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationPreservesTheSingleTokenRuleWithoutBraces is a Go unit entry in the native test process; it calls parseDeclarations on one in-memory comment string with no filesystem, consumer install or product host.
 */
func TestDeclarationPreservesTheSingleTokenRuleWithoutBraces(t *testing.T) {
  parsed := parseDeclarations("/** @evidence POST /members Creates a member. */")
  if len(parsed) != 1 || parsed[0].Target != "POST" {
    t.Fatalf("parsed as %+v", parsed)
  }
  if parsed[0].Reason != "/members Creates a member." {
    t.Fatalf("reason: %q", parsed[0].Reason)
  }
}
