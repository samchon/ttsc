declare const source: { x: number };
declare const extras: { y: number };

// Positive: Object.assign with empty literal as the first argument.
// expect: prefer-object-spread error
const merged = Object.assign({}, source);

// Positive: Object.assign({}, a, b) form with multiple sources.
// expect: prefer-object-spread error
const combined = Object.assign({}, source, extras);

// Negative: mutating Object.assign — the spread form does not preserve
// this behavior, so leave it alone.
const mutated = Object.assign(source, extras);

// Negative: Object.assign with a single argument (a clone-shape that
// the rule does not target).
const cloned = Object.assign({});

JSON.stringify({ merged, combined, mutated, cloned });
