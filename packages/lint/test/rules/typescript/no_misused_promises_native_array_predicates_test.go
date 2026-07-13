package linthost

import "testing"

// TestNoMisusedPromisesNativeArrayPredicates pins the upstream native-array
// boundary independently from structurally array-like user APIs.
//
//  1. Cover dot, static computed, template, and optional access on mutable,
//     readonly, tuple, union, intersection, and constrained receivers.
//  2. Keep dynamic keys and Promise-aware numeric-indexed APIs clean.
//  3. Require one diagnostic when predicate and void-argument analysis overlap.
func TestNoMisusedPromisesNativeArrayPredicates(t *testing.T) {
  assertNoMisusedPromisesCase(t, "main.ts", `const mutable = [1, 2, 3];
declare const readonlyValues: readonly number[];
declare const tuple: readonly [number, number];
declare const maybeValues: number[] | undefined;

// expect: typescript/no-misused-promises error
mutable.filter(async value => value > 0);
// expect: typescript/no-misused-promises error
mutable["find"](async value => value > 0);
// expect: typescript/no-misused-promises error
mutable[`some`](async value => value > 0);
// expect: typescript/no-misused-promises error
mutable[("filter")](async value => value > 0);
// expect: typescript/no-misused-promises error
mutable?.["every"](async value => value > 0);
// expect: typescript/no-misused-promises error
maybeValues?.findIndex(async value => value > 0);
// expect: typescript/no-misused-promises error
readonlyValues["find"](async value => value > 0);
// expect: typescript/no-misused-promises error
tuple.some(async value => value > 0);

const dynamicMethod: "filter" = "filter";
mutable[dynamicMethod](async value => value > 0);

interface PromiseAwareArrayLike<T> {
  readonly length: number;
  readonly [index: number]: T;
  filter(predicate: (value: T) => boolean): T[];
  filter(predicate: (value: T) => Promise<boolean>): Promise<T[]>;
}
declare const promiseAware: PromiseAwareArrayLike<number>;
promiseAware.filter(async value => value > 0);

interface PromiseAwareReadonlyArray<T> extends ReadonlyArray<T> {
  filter<S extends T>(
    predicate: (value: T, index: number, array: readonly T[]) => value is S,
    thisArg?: any,
  ): S[];
  filter(
    predicate: (value: T, index: number, array: readonly T[]) => Promise<boolean>,
    thisArg?: any,
  ): Promise<readonly T[]>;
  filter(
    predicate: (value: T, index: number, array: readonly T[]) => unknown,
    thisArg?: any,
  ): T[];
}
declare const promiseAwareReadonly: PromiseAwareReadonlyArray<number>;
promiseAwareReadonly.filter(async value => value > 0);

declare const union: number[] | readonly number[];
// expect: typescript/no-misused-promises error
union["filter"](async value => value > 0);

declare const intersection: readonly number[] & { readonly marker: true };
// expect: typescript/no-misused-promises error
intersection.find(async value => value > 0);

function checkConstrained<T extends readonly number[]>(values: T): void {
  // expect: typescript/no-misused-promises error
  values.every(async value => value > 0);
}

type ArrayWithVoidFilter = number[] & {
  filter(predicate: (value: number) => void): number[];
};
declare const overlapping: ArrayWithVoidFilter;
// expect: typescript/no-misused-promises error
overlapping.filter(async value => { void value; });

void [mutable, readonlyValues, tuple, maybeValues, promiseAware, promiseAwareReadonly, union, intersection, checkConstrained, overlapping];
`, nil)
}
