package evidence

import "testing"

/**
 * Verifies a path target is untouched by the braced grammar.
 *
 * The negative twin that keeps the extension an extension. Markdown and Swagger
 * targets stay one whitespace-delimited token, and a change that quietly
 * reinterpreted them would break every existing citation.
 *
 *  1. Parse Markdown and Swagger targets.
 *  2. Read back each target and reason.
 *  3. Assert neither is treated as an inline link.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseDeclarations exercises this case: Verifies a path target is untouched by the braced grammar. The original assertions check assert neither is treated as an inline link.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The negative twin that keeps the extension an extension. Markdown and Swagger targets stay one whitespace-delimited token, and a change that quietly reinterpreted them would break every existing citation. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Parse Markdown and Swagger targets. Read back each target and reason. Assert neither is treated as an inline link. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDeclarationKeepsPathTargetsWhitespaceDelimited is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls parseDeclarations within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDeclarationKeepsPathTargetsWhitespaceDelimited(t *testing.T) {
  for comment, want := range map[string]string{
    "/** @evidence docs/spec.md#pricing Derives from this section. */": "docs/spec.md#pricing",
    "/** @evidence POST:/members Follows this operation. */":           "POST:/members",
  } {
    parsed := parseDeclarations(comment)
    if len(parsed) != 1 {
      t.Fatalf("comment %q parsed as %+v", comment, parsed)
    }
    if isInlineLinkTarget(parsed[0].Target) {
      t.Fatalf("comment %q became an inline link target", comment)
    }
    if parsed[0].Target != want {
      t.Fatalf("target: %q, want %q", parsed[0].Target, want)
    }
  }
}
