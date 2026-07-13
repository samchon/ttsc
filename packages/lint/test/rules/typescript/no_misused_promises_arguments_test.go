package linthost

import "testing"

// TestNoMisusedPromisesArguments resolves overload, union, generic, optional,
// and rest callback contracts without relying on API names.
//
// 1. Supply Promise-returning callbacks to void-only signature positions.
// 2. Supply the same callbacks to Promise-aware overloads and unions.
// 3. Require findings only where every applicable contract discards returns.
func TestNoMisusedPromisesArguments(t *testing.T) {
  assertNoMisusedPromisesCase(t, "main.ts", `declare function arbitrary(callback: () => void): void;
declare function optional(callback?: () => void): void;
declare function optionalAsync(callback?: () => Promise<void>): void;
declare function rest(...callbacks: Array<() => void>): void;
declare function restAsync(...callbacks: Array<() => Promise<void>>): void;
declare function tupleRest(...callbacks: [() => void, () => Promise<void>]): void;
declare function generic<T extends () => void>(callback: T): void;
declare function genericAsync<T extends () => Promise<void>>(callback: T): void;
declare const acceptsEither: (callback: (() => void) | (() => Promise<void>)) => void;
declare function overloaded(callback: () => void): void;
declare function overloaded(callback: () => Promise<void>): void;
declare function voidOverloaded(callback: () => void): void;
declare function voidOverloaded(callback: () => void, label?: string): void;
declare const unionVoid: ((callback: () => void) => void) | ((callback: () => void, label?: string) => void);
declare class VoidConsumer { constructor(callback: () => void); }
declare class AsyncConsumer { constructor(callback: () => Promise<void>); }

arbitrary(
  // expect: typescript/no-misused-promises error
  async () => {},
);
// expect: typescript/no-misused-promises error
optional(() => Promise.resolve());
optionalAsync(async () => {});
// expect: typescript/no-misused-promises error
rest(() => {}, async () => {});
restAsync(async () => {}, () => Promise.resolve());
tupleRest(
  // expect: typescript/no-misused-promises error
  async () => {},
  async () => {},
);
// expect: typescript/no-misused-promises error
generic(async () => {});
genericAsync(async () => {});
acceptsEither(async () => {});
overloaded(async () => {});
// expect: typescript/no-misused-promises error
voidOverloaded(async () => {});
// expect: typescript/no-misused-promises error
unionVoid(async () => {});
// expect: typescript/no-misused-promises error
new VoidConsumer(async () => {});
new AsyncConsumer(async () => {});

arbitrary(() => async () => {});
arbitrary(() => {
  // expect: typescript/no-misused-promises error
  arbitrary(async () => {});
});

declare const voidForEach: { forEach(callback: () => void): void };
declare const namedForEach: { forEach(callback: () => Promise<void>): void };
// expect: typescript/no-misused-promises error
voidForEach.forEach(() => Promise.resolve());
namedForEach.forEach(async () => {});

declare const customFinally: { finally(callback: () => void): void };
// expect: typescript/no-misused-promises error
customFinally.finally(async () => {});
Promise.resolve().finally(async () => {});

declare const customFilter: { filter(callback: () => Promise<boolean>): void };
customFilter.filter(() => Promise.resolve(true));
`, nil)
}
