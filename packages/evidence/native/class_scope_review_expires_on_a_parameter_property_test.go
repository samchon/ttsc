package evidence

import "testing"

/**
 * Verifies a review of a class expires when a field the constructor declares
 * changes.
 *
 * This is the behavior a reviewer meets: sign off on a class, have a
 * constructor-declared field rewritten underneath, and the review expires. It
 * is deliberately paired with the complementary regression, because on its own it proves
 * less than it looks. A TypeScript unit's digest is its whole declaration text,
 * so the constructor's bytes sit inside the class digest whether or not the
 * shorthand is a subtree member, and this case would pass even if parameter
 * properties materialized nothing at all.
 *
 *  1. Cite the class from another module and review it with the value the graph
 *     asks for.
 *  2. Assert the graph is clean.
 *  3. Change the parameter property's type and assert the review is now stale.
 * @evidence contracts/testing.md#behavioral-verification assertClassScopeReviewExpires runs accepted baseline and changed bigint parameter-property schemas; the graph must report stale Sale.
 * @evidence contracts/testing.md#independent-expectations A review over Sale must expire when its public price type changes. The initial token is production-derived, and the class's own text also changes, so this case alone does not establish parameter-property membership.
 * @evidence contracts/testing.md#distinguishing-cases The explicit constructor baseline isolates number-to-bigint type mutation; documentation-only withdrawal is covered by ClassScopeReviewExpiresWhenAParameterPropertyIsWithdrawn.
 * @evidence contracts/testing.md#execution-ownership TestClassScopeReviewExpiresOnAParameterProperty is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestClassScopeReviewExpiresOnAParameterProperty(t *testing.T) {
  assertClassScopeReviewExpires(t, `
export class Sale {
  readonly declared: number = 0;
  constructor(
    /**
     * The price the customer pays.
     */
    public readonly price: bigint,
  ) {}
}
`)
}
