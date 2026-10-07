// Generic with one defaulted type parameter — passing `string` as that
// argument repeats the default and could be dropped.
declare function withDefault<T = string>(value: T): T;

// Generic class with a defaulted type parameter — `new Box<number>()`
// is required (no default match); `new Box<string>()` redundantly states
// the default.
declare class Box<T = string> {
  constructor(value?: T);
}

// Positive: function generic argument equals the declared default.
// expect: typescript/no-unnecessary-type-arguments error
const a = withDefault<string>("hello");

// Positive: constructor generic argument equals the declared default.
// expect: typescript/no-unnecessary-type-arguments error
const b = new Box<string>("world");

// Negative: argument differs from the default — the explicit form is
// the only way to pick `number`.
const c = withDefault<number>(1);

// Negative: omitting the type-argument list entirely — nothing to flag.
const d = withDefault("default");

JSON.stringify({ a, b, c: c, d });
