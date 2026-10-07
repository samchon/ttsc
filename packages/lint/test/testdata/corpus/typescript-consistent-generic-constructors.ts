// Positive: generic on both the annotation and the constructor.
// expect: typescript/consistent-generic-constructors error
const a: Map<string, number> = new Map<string, number>();

// Negative: generic only on the constructor (TypeScript infers from
// the call).
const b = new Map<string, number>();

// Negative: generic only on the annotation (TypeScript inhabits the
// type parameter on construction).
const c: Map<string, number> = new Map();

JSON.stringify({ a, b, c });
