// Positive: `a` follows `b` and breaks ascending order; the rule
// flags the offending key, not the preceding one.
const unsorted = {
  b: 1,
  // expect: sort-keys error
  a: 2,
};
void unsorted;

// Positive: string-literal keys participate in the same sort group as
// identifier keys. `"10"` (digit byte) sorts before `alpha` (letter byte),
// so the literal key reports.
const mixed = {
  alpha: 1,
  // expect: sort-keys error
  "10": 2,
};
void mixed;

// Negative: a spread divider resets the sort baseline, so keys after
// the spread restart their own ordered group.
const withSpread = {
  z: 1,
  ...({ extra: 0 } as Record<string, number>),
  a: 2,
  b: 3,
};
void withSpread;

// Negative: alphabetical keys do not fire.
const sorted = {
  alpha: 1,
  beta: 2,
  gamma: 3,
};
void sorted;

// Negative: a single-key object literal has nothing to compare.
const solo = { only: 1 };
void solo;
