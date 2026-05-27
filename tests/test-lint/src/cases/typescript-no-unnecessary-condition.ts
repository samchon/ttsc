declare const obj: { value: number };
declare const maybe: { value: number } | null;
declare const dyn: string;
declare const alwaysNull: null;
declare const emptyString: "";
declare const zero: 0;
declare const ready: "ready";
declare function sideEffect(value: unknown): void;

// Positive: a non-nullable object in `if` is always truthy.
// expect: typescript/no-unnecessary-condition error
if (obj) {
  sideEffect(obj);
}

// Positive: a `null`-typed binding in a ternary is always falsy. The
// literal `null` would be pre-flagged by the type-checker as TS2873, so
// we route the value through a named declaration to keep the rule the
// sole reporter.
// expect: typescript/no-unnecessary-condition error
const fromNull = alwaysNull ? "yes" : "no";

// Positive: an `""`-typed binding in a `while` is always falsy.
// expect: typescript/no-unnecessary-condition error
while (emptyString) {
  break;
}

// Positive: a `0`-typed binding used as a ternary discriminant is
// always falsy.
// expect: typescript/no-unnecessary-condition error
const fromZero = zero ? "yes" : "no";

// Positive: `!` on a non-nullable object — always-truthy operand.
// expect: typescript/no-unnecessary-condition error
const negated = !obj;

// Positive: `&&` left operand is a non-empty string-literal binding —
// always truthy.
// expect: typescript/no-unnecessary-condition error
const guarded = ready && sideEffect("go");

// Negative: nullable object — `obj` could be `null`, the guard is meaningful.
if (maybe) {
  sideEffect(maybe);
}

// Negative: plain `string` — could be `""` or non-empty.
if (dyn) {
  sideEffect(dyn);
}

// Negative: explicit comparison naming the intent on an always-truthy value.
if (obj !== undefined) {
  sideEffect(obj);
}

sideEffect({ fromNull, negated, guarded });
