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
 */
func TestFileLinksAddressLiteralExports(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/example.ts": `class Target { static "a b" = 1; } export { Target as "Public.name here" };`,
    "review.md":      "## Review\n<!-- @link src/example.ts#[\"Public.name here\"][\"a b\"] Checks the literal names. -->\n",
  }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/example.ts"],"symbol":"property"}}]}`))
}
