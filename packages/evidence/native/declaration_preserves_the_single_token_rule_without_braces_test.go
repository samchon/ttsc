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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseDeclarations exercises this case: Verifies the two-token Swagger hazard does not recur through the brace path. The original assertions check assert the first token alone is the target.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `POST /members` must still parse as the target `POST` with the rest as its reason, because the parser has no reference context to tell a Swagger path from a TypeScript symbol named `POST`. The brace is what supplies a boundary where one is genuinely needed. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Parse a space-separated Swagger-looking target. Read back the target. Assert the first token alone is the target. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDeclarationPreservesTheSingleTokenRuleWithoutBraces is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls parseDeclarations within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
