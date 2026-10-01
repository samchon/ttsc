declare const names: string[];

// Positive: the accumulator is annotated only via `as` on the initial
// value — `reduce<T>(...)` would lock the accumulator type at the call
// site instead. The rule reports on the `as` expression itself, so the
// expectation annotation anchors to the initial-value line.
const intoSet = names.reduce(
  (acc, name) => {
    acc.add(name);
    return acc;
  },
  // expect: typescript/prefer-reduce-type-parameter error
  new Set<string>() as Set<string>,
);

// Positive: the same shape with a plain `as` cast on an object literal
// initial value.
const intoMap = names.reduce(
  (acc, name) => {
    acc[name] = name.length;
    return acc;
  },
  // expect: typescript/prefer-reduce-type-parameter error
  {} as Record<string, number>,
);

// Negative: explicit type parameter is already present — no rewrite to
// suggest.
const intoTypedSet = names.reduce<Set<string>>((acc, name) => {
  acc.add(name);
  return acc;
}, new Set<string>());

// Negative: no `as` assertion on the initial value — the rule only
// targets the assertion-on-initial-value pattern.
const joined = names.reduce((acc, name) => acc + name, "");

void intoSet;
void intoMap;
void intoTypedSet;
void joined;
