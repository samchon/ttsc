declare const num: number;
declare const str: string;
declare const big: bigint;
declare const obj: { kind: "x" };
declare const maybeNum: number | null;

// Positive: number + string is the canonical case the rule guards.
// expect: typescript/restrict-plus-operands error
const a = 1 + "a";

// Positive: null + number — `null` coerces to 0 at runtime.
// expect: typescript/restrict-plus-operands error
const b = maybeNum + 1;

// Positive: object + number — coerces the object via `String()`.
// expect: typescript/restrict-plus-operands error
const c = obj + 1;

// Negative: number + number is fine.
const d = num + 1;

// Negative: string + string is fine.
const e = str + "!";

// Negative: bigint + bigint is fine.
const f = big + 1n;

JSON.stringify({ a, b, c, d, e, f });
