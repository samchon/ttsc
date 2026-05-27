// Positive: union with `any` absorbs every other constituent.
// expect: typescript/no-redundant-type-constituents error
type WithAny = string | any;

// Positive: union with `unknown` absorbs every other constituent.
// expect: typescript/no-redundant-type-constituents error
type WithUnknown = string | unknown;

// Positive: `never` disappears from a union.
// expect: typescript/no-redundant-type-constituents error
type UnionNever = string | never;

// Positive: `T & never` collapses to `never` — both constituents fire.
// expect: typescript/no-redundant-type-constituents error
// expect: typescript/no-redundant-type-constituents error
type InterNever = string & never;

// Positive: `unknown` disappears from an intersection.
// expect: typescript/no-redundant-type-constituents error
type InterUnknown = string & unknown;

// Positive: duplicate constituent in a union fires on the second.
// expect: typescript/no-redundant-type-constituents error
type DupeUnion = string | string;

// Positive: duplicate constituent in an intersection fires on the second.
// expect: typescript/no-redundant-type-constituents error
type DupeInter = { a: 1 } & { a: 1 };

// Negative: distinct constituents are fine.
type Ok1 = string | number;
type Ok2 = { a: 1 } & { b: 2 };

// Use every declaration so it survives `isolatedModules` style checks.
declare const samples: [
  WithAny,
  WithUnknown,
  UnionNever,
  InterNever,
  InterUnknown,
  DupeUnion,
  DupeInter,
  Ok1,
  Ok2,
];
JSON.stringify(samples);
