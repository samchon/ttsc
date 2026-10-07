// Canonical order: primitives alphabetized first, then object / named
// references alphabetized, then nullish singletons (`null`,
// `undefined`) last.

// Positive: primitives out of alphabetical order — `string` should come
// after `number`.
// expect: typescript/sort-type-constituents error
type OutOfOrderPrimitives = string | number;

// Positive: `null` listed before a non-nullish constituent.
// expect: typescript/sort-type-constituents error
type NullFirst = null | string;

// Positive: object types out of alphabetical order — `B` before `A`.
interface A {
  a: number;
}
interface B {
  b: number;
}
// expect: typescript/sort-type-constituents error
type ObjectsOutOfOrder = B | A;

// Positive: intersection constituents in the wrong group order — the
// rule applies to intersections too.
// expect: typescript/sort-type-constituents error
type InterOutOfOrder = B & A;

// Negative: already in canonical order.
type Ok1 = number | string;
type Ok2 = string | null;
type Ok3 = number | string | null | undefined;
type Ok4 = A & B;

declare const samples: [
  OutOfOrderPrimitives,
  NullFirst,
  ObjectsOutOfOrder,
  InterOutOfOrder,
  Ok1,
  Ok2,
  Ok3,
  Ok4,
];
JSON.stringify(samples);
