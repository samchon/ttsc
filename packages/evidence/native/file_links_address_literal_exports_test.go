package evidence

import "testing"

/**
 * Verifies literal public export names remain one accessor segment.
 *
 * A module export containing a dot is a literal name, like a quoted member.
 * Splitting it during traversal makes a valid public declaration disappear.
 *
 * 1. Expose a class through a quoted alias containing a dot and a space.
 * 2. Cite its literal member through bracket segments.
 * 3. Verify the configured property remains one acknowledged unit.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies literal public export names remain one accessor segment.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The authored quoted export and space-bearing static member identify one property; a clean graph must acknowledge that property without splitting literal names.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Expose a class through a quoted alias containing a dot and a space. Cite its literal member through bracket segments. Verify the configured property remains one acknowledged unit.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFileLinksAddressLiteralExports is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestFileLinksAddressLiteralExports(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/example.ts": `class Target { static "a b" = 1; } export { Target as "Public.name here" };`,
    "review.md":      "## Review\n<!-- @link src/example.ts#[\"Public.name here\"][\"a b\"] Checks the literal names. -->\n",
  }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/example.ts"],"symbol":"property"}}]}`))
}
