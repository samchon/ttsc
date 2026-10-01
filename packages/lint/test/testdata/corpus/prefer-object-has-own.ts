declare const target: { x: number };

// Positive: the canonical hasOwnProperty.call form.
// expect: prefer-object-has-own error
const a = Object.prototype.hasOwnProperty.call(target, "x");

// Negative: the suggested replacement.
const b = Object.hasOwn(target, "x");

// Negative: a user-typed object whose name happens to be `hasOwnProperty`.
const facade = {
  hasOwnProperty(key: string): boolean {
    JSON.stringify(key);
    return false;
  },
};
const c = facade.hasOwnProperty("x");

JSON.stringify({ a, b, c });
