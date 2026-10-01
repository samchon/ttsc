/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.
 * @evidence docs/spec.md#refunds Applies the refund window this section sets.
 */
export interface ISale {
  price: number;
}
