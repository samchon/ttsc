package evidence

import "testing"

/**
 * Verifies default values retain their members beside type-only named aliases.
 *
 * The inventory must keep the value side needed by default without publishing
 * it through a type-only name or creating a second default obligation.
 *
 * 1. Default-export a class beside type-only and value aliases in both orders.
 * 2. Cite default's field and verify each value path reaches that one unit.
 * 3. Cite the type-only field and verify the value restriction remains.
 */
func TestFileLinksKeepDefaultValueAliases(t *testing.T) {
  for _, exports := range []string{
    "export type { Target as Public }; export default Target;",
    "export default Target; export type { Target as Public };",
    "export { Target as Z }; export type { Target as A }; export default Target;",
    "export type { Target as Z }; export { Target as A }; export default Target;",
  } {
    fixture := newFileLinkFixture(t, map[string]string{"api/index.ts": "class Target { static value = 1; } " + exports, "review.md": "## Review\n<!-- @link api/index.ts#default.value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
    assertNoProblems(t, fixture.check())
    if exports == "export type { Target as Public }; export default Target;" {
      fixture.write("review.md", "## Review\n<!-- @link api/index.ts#Public.value Attempts a type-only value path. -->\n")
      assertProblemContains(t, fixture.check(), "Type-only")
    }
  }
}
