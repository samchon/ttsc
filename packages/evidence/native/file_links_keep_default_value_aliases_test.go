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
 *
 * @evidence contracts/testing.md#behavioral-verification For four export-statement orderings of `class Target { static value = 1; }` with a default export and type-only and value aliases, newFileLinkFixture links `api/index.ts#default.value` and the graph must be clean; for the first ordering a link `#Public.value` through the type-only alias must report `Type-only`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the export contract: a default export keeps its value members whatever type-only aliases or statement order surround it, while the type-only alias itself cannot publish value members.
 * @evidence contracts/testing.md#distinguishing-cases Four orderings and alias kinds (type-only before or after the default, value aliases named to sort before and after) guard order dependence; the negative arm runs for the first ordering only and checks the diagnostic by containment.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksKeepDefaultValueAliases is a Go unit entry in the native test process that loops over four orderings (not named subtests); each drives graphRule.Check through newFileLinkFixture over real temp files, with no consumer install or product host.
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
