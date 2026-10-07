declare const obj: { a: number; b: number };
declare const arr: readonly number[];

// Positive: `const a = obj.a;` is just the longhand object-destructuring form.
// expect: prefer-destructuring error
const a = obj.a;

// Positive: `const first = arr[0];` is just the longhand array form.
// expect: prefer-destructuring error
const first = arr[0];

// Negative: the variable name does not match the property — the
// destructuring form would need a rename, which is a different code style.
const renamed = obj.b;

// Negative: destructuring already in use.
const { b } = obj;

// Negative: computed string-literal access is usually deliberate.
const c = obj["a"];

JSON.stringify({ a, first, renamed, b, c });
