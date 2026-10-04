/**
 * Renders the stacking notice.
 *
 * @evidence docs/discount.md#coupon-stacking States the per-issuer
 *           stacking limit this section defines.
 * @evidence POST:/orders/{orderId}/coupons Explains the rejection.
 */
export function renderNotice(): string { return 'notice'; }
/** @evidence docs/discount.md#coupon-stacking Enforces the same limit. */
export function applyCoupons(): number { return 0; }
/** @reference https://example.com/spec Background reading. */
export function documented(): void {}
/** Carries no tag at all. */
export function untagged(): void {}
/** @evidence docs/boot.md#start Starts the application. */
export function bootstrap(): void { run(); }
/** Does the work. */
export function run(): void {}
