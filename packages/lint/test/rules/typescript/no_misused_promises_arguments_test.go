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
declare function rest(...callbacks: Array<() => void>): void;
declare function generic<T extends () => void>(callback: T): void;
declare const acceptsEither: (callback: (() => void) | (() => Promise<void>)) => void;
declare function overloaded(callback: () => void): void;
declare function overloaded(callback: () => Promise<void>): void;

// expect: typescript/no-misused-promises error
arbitrary(async () => {});
// expect: typescript/no-misused-promises error
optional(() => Promise.resolve());
// expect: typescript/no-misused-promises error
rest(() => {}, async () => {});
// expect: typescript/no-misused-promises error
generic(async () => {});
acceptsEither(async () => {});
overloaded(async () => {});

declare const namedForEach: { forEach(callback: () => Promise<void>): void };
namedForEach.forEach(async () => {});
`, nil)
}
