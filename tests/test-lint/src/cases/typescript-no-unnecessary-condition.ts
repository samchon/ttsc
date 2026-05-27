declare const obj: { value: number };
declare const maybe: { value: number } | null;
declare const dyn: string;
declare function sideEffect(value: unknown): void;

// Positive: a non-nullable object in `if` is always truthy.
// expect: typescript/no-unnecessary-condition error
if (obj) {
  sideEffect(obj);
}

// Positive: `null` literal in a ternary is always falsy.
// expect: typescript/no-unnecessary-condition error
const fromNull = null ? "yes" : "no";

// Positive: `""` in a `while` is always falsy.
// expect: typescript/no-unnecessary-condition error
while ("") {
  break;
}

// Positive: `0` in a `do ... while` is always falsy.
// expect: typescript/no-unnecessary-condition error
do {
  break;
} while (0);

// Positive: `!` on a non-nullable object — always-truthy operand.
// expect: typescript/no-unnecessary-condition error
const negated = !obj;

// Positive: `&&` left operand is a non-empty string literal — always truthy.
// expect: typescript/no-unnecessary-condition error
const guarded = "ready" && sideEffect("go");

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
