declare const maybe: string | undefined;
declare const other: string;

// expect: typescript/prefer-nullish-coalescing error
const a = maybe || other;

let b: string | undefined = maybe;
// expect: typescript/prefer-nullish-coalescing error
b ||= other;

// expect: typescript/prefer-nullish-coalescing error
const c = maybe ? maybe : other;

// Boolean context — `||` is fine here because the surrounding `if`
// already coerces to boolean, so the falsy-vs-nullish distinction does
// not matter.
if (maybe || other) {
  JSON.stringify(maybe);
}
while (maybe || other) {
  break;
}
const d = !(maybe || other);
const e = maybe || other ? "t" : "f";

// Already using `??` — never fires.
const f = maybe ?? other;
let g: string | undefined = maybe;
g ??= other;

JSON.stringify({ a, b, c, d, e, f, g });
