// Positive: primitives out of alphabetical order — `string` should
// come after `number`.
// expect: typescript/sort-type-constituents error
type OutOfOrderPrimitives = string | number;

// Positive: `null` listed before a non-nullish constituent.
// expect: typescript/sort-type-constituents error
type NullFirst = null | string;

// Negative: already in canonical order.
type Ok1 = number | string;
type Ok2 = string | null;

declare const samples: [OutOfOrderPrimitives, NullFirst, Ok1, Ok2];
JSON.stringify(samples);
