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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over src/example.ts (`class Target { static "a b" = 1; } export { Target as "Public.name here" };`) and a review.md whose `@link` is `src/example.ts#["Public.name here"]["a b"]`, with a Markdown claim and a TypeScript property reference; assertNoProblems requires an empty diagnostic list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the addressing contract: an export name containing a dot is a literal name, like a quoted member, so bracket segments must address the quoted export and its space-bearing static member as one acknowledged property.
 * @evidence contracts/testing.md#distinguishing-cases A quoted export containing a dot and a quoted member containing a space in one address; splitting the name on the dot would leave the address unresolved and the property unacknowledged, so silence fails only if the literal names are kept whole.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksAddressLiteralExports is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestFileLinksAddressLiteralExports(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/example.ts": `class Target { static "a b" = 1; } export { Target as "Public.name here" };`,
    "review.md":      "## Review\n<!-- @link src/example.ts#[\"Public.name here\"][\"a b\"] Checks the literal names. -->\n",
  }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/example.ts"],"symbol":"property"}}]}`))
}
