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
 *
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations is called on `@evidence docs/spec.md#pricing ...` and `@evidence POST:/members ...`; each must yield exactly one declaration whose target is not an inline link target and equals `docs/spec.md#pricing` and `POST:/members` respectively.
 * @evidence contracts/testing.md#independent-expectations The expected targets are authored literals: Markdown and Swagger targets remain one whitespace-delimited token and the braced inline-link grammar must not reinterpret them.
 * @evidence contracts/testing.md#distinguishing-cases A Markdown path target and a Swagger operation target are the two non-braced forms; the braced forms are covered by sibling entries, and the loop covers the map's two entries as plain iterations.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationKeepsPathTargetsWhitespaceDelimited is a Go unit entry in the native test process; it calls parseDeclarations on in-memory comment strings with no filesystem, consumer install or product host.
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
