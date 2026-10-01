declare const anyValue: any;
declare const safe: { id: number };

// Positive: dotted access on an `any` receiver returns another `any`.
// expect: typescript/no-unsafe-member-access error
const prop = anyValue.foo;

// Positive: computed access on `any` is just as unsafe.
// expect: typescript/no-unsafe-member-access error
const computed = anyValue["bar"];

// Negative: access on a typed receiver is fine.
const ok = safe.id;

JSON.stringify({ prop, computed, ok });
