declare const numbers: number[];
declare const tuple: readonly [number, number, number];

// expect: typescript/require-array-sort-compare error
numbers.sort();

// expect: typescript/require-array-sort-compare error
numbers.toSorted();

// expect: typescript/require-array-sort-compare error
tuple.toSorted();

// Comparator supplied — never fires.
numbers.sort((a, b) => a - b);
numbers.toSorted((a, b) => b - a);

// Non-array receiver with a `sort` method — the Checker rules it out, so
// the lint engine must not confuse it with `Array#sort`.
declare const fakeSorter: { sort(): void };
fakeSorter.sort();

JSON.stringify({ numbers, tuple });
