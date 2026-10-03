declare const plain: { id: number };
declare const date: Date;

// Positive: template literal interpolates a plain object — coerces to
// the default `"[object Object]"`.
// expect: typescript/no-base-to-string error
const message = `value: ${plain}`;

// Positive: `+ ""` forces the same Object.prototype.toString path.
// expect: typescript/no-base-to-string error
const concat = plain + "";

// Positive: explicit `String(...)` on a base-toString type.
// expect: typescript/no-base-to-string error
const wrapped = String(plain);

// Negative: `Date` overrides `toString`, so coercion produces a real string.
const stamp = `at ${date}`;

JSON.stringify({ message, concat, wrapped, stamp });
