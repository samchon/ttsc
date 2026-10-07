package evidence

import "testing"

/**
 * Verifies withdrawing a parameter property expires the review of its class.
 *
 * The case that isolates subtree membership, which ClassScopeReviewExpiresOnAParameterProperty
 * cannot. Every documentation block is cut out of a unit's digest as a position
 * a tag can occupy, so adding `@internal` to the parameter leaves the class's
 * own text byte-identical. The composite moves only because the withdrawn
 * member is in the scope and contributes the tag that withdrew it. If parameter
 * properties were not subtree members, nothing here would change and the review
 * would stand while a field left the public surface under it.
 *
 *  1. Review the same class with the value the graph asks for.
 *  2. Withdraw the parameter property with `@internal`.
 *  3. Assert the review is stale.
 *
 * @evidence contracts/testing.md#behavioral-verification assertClassScopeReviewExpires accepts the Sale baseline, adds only @internal to price's documentation, then requires stale Sale.
 * @evidence contracts/testing.md#independent-expectations Public-scope membership changes require expiry even if declaration text digest stays unchanged; the companion text-invariance case checks that premise.
 * @evidence contracts/testing.md#distinguishing-cases The documentation-only mark challenges subtree withdrawal rather than ordinary type-content expiry; the token seed does not establish exact hashing.
 * @evidence contracts/testing.md#execution-ownership TestClassScopeReviewExpiresWhenAParameterPropertyIsWithdrawn is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestClassScopeReviewExpiresWhenAParameterPropertyIsWithdrawn(t *testing.T) {
  assertClassScopeReviewExpires(t, classWithdrawnSource)
}
