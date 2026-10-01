declare const text: string;
declare const flag: boolean;
declare const obj: { value: number };
declare const num: number;
declare const big: bigint;

// Positive: unary minus on a `string` operand — coerces via `Number(x)`,
// which silently yields `NaN` for non-numeric text.
// expect: typescript/no-unsafe-unary-minus error
const a = -text;

// Positive: unary minus on a `boolean` operand — coerces to `0` / `-1`.
// expect: typescript/no-unsafe-unary-minus error
const b = -flag;

// Positive: unary minus on an object — coerces via the `valueOf` /
// `toString` chain.
// expect: typescript/no-unsafe-unary-minus error
const c = -obj;

// Negative: number is fine.
const d = -num;

// Negative: bigint is fine.
const e = -big;

JSON.stringify({ a, b, c, d, e: String(e) });
