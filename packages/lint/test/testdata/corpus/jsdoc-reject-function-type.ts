/**
 * Registers a callback.
// expect: jsdoc/reject-function-type error
 * @param {Function} handler description
 */
export function register(handler: () => void): void {
  handler();
}
