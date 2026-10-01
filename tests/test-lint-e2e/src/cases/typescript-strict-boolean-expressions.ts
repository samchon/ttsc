declare const count: number;
declare const name: string;
declare const obj: { value: number } | null;
declare const flag: boolean;
declare function sideEffect(value: unknown): void;

// Positive: number in `if` condition — `0` and `NaN` are silently falsy.
// expect: typescript/strict-boolean-expressions error
if (count) {
  sideEffect(count);
}

// Positive: string in `while` condition — `""` is silently falsy.
// expect: typescript/strict-boolean-expressions error
while (name) {
  break;
}

// Positive: nullable object in `!` operand — collapses present-vs-absent.
// expect: typescript/strict-boolean-expressions error
const absent = !obj;

// Positive: string in `&&` left position — `someString && doStuff()`.
// expect: typescript/strict-boolean-expressions error
const guarded = name && sideEffect(name);

// Positive: number in ternary test position.
// expect: typescript/strict-boolean-expressions error
const label = count ? "yes" : "no";

// Negative: pure boolean in `if` — the explicit shape the rule asks for.
if (flag) {
  sideEffect(flag);
}

// Negative: explicit comparison naming the intent.
if (count !== 0) {
  sideEffect(count);
}

// Negative: nullish guard before the access — `obj != null` is boolean.
if (obj != null) {
  sideEffect(obj.value);
}

sideEffect({ absent, guarded, label });
