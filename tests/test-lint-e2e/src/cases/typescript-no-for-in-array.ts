declare const numbers: number[];
declare const tuple: readonly [string, string];
declare const mixed: number[] | string[];
declare const record: Record<string, number>;
declare const set: Set<number>;
declare function sideEffect(value: unknown): void;

// Positive: plain `number[]` array.
// expect: typescript/no-for-in-array error
for (const key in numbers) {
  sideEffect(key);
}

// Positive: tuple type — fixed-length tuple is still array-like at runtime.
// expect: typescript/no-for-in-array error
for (const key in tuple) {
  sideEffect(key);
}

// Positive: union of arrays — every constituent is array-like, so the
// constituent-recursion arm of noForInArrayIsArrayLike fires.
// expect: typescript/no-for-in-array error
for (const key in mixed) {
  sideEffect(key);
}

// Negative: `for...of` over an array is the recommended replacement.
for (const value of numbers) {
  sideEffect(value);
}

// Negative: `for...in` over an object record is the intended use of the
// statement — the Checker reports the type as non-array, so the rule stays
// silent.
for (const key in record) {
  sideEffect(record[key]);
}

sideEffect(set);
