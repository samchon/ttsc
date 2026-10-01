declare const value: unknown;
declare const count: number | undefined;

// Positive: `!!x` for boolean coercion.
// expect: no-implicit-coercion error
const asBool = !!value;

// Positive: `+x` for number coercion.
// expect: no-implicit-coercion error
const asNum = +String(count);

// Positive: `"" + x` for string coercion.
// expect: no-implicit-coercion error
const asStrA = "" + count;

// Positive: `x + ""` for string coercion (right-hand side).
// expect: no-implicit-coercion error
const asStrB = count + "";

// Negative: explicit conversions.
const okBool = Boolean(value);
const okNum = Number(count);
const okStr = String(count);

// Negative: `+0` and `+1` are positive-number literals, not coercions.
const positiveOne = +1;

JSON.stringify({ asBool, asNum, asStrA, asStrB, okBool, okNum, okStr, positiveOne });
