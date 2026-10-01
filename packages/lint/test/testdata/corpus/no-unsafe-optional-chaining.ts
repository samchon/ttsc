declare const obj: { foo?: { bar: number } } | undefined;
declare const arr: number[] | undefined;
declare function maybeCallable(): (() => number) | undefined;

// Positive: property access after a terminated optional chain.
// expect: no-unsafe-optional-chaining error
const a = (obj?.foo).bar;

// Positive: element access after a terminated optional chain.
// expect: no-unsafe-optional-chaining error
const b = (arr?.[0])!.toFixed();

// Positive: call after a terminated optional chain.
// expect: no-unsafe-optional-chaining error
const c = maybeCallable?.()();

// Negative: chain continues with another `?.` — safe.
const d = obj?.foo?.bar;

// Negative: no optional chain at all — vanilla member access is fine.
const e = obj?.foo?.bar ?? 0;

JSON.stringify({ a, b, c, d, e });
