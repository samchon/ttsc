package linthost

import "testing"

// TestNoLoopFuncAllowsUsingBindings verifies `using` and `await using` share
// the same immutable-capture exemption as const declarations.
//
// TypeScript represents both resource declarations with constant flag bits.
// Even an ignored illegal reassignment must not make the rule diverge from
// ESLint's declaration-kind contract.
//
// 1. Declare disposable and async-disposable resources inside loops.
// 2. Capture each resource and include a suppressed reassignment attempt.
// 3. Assert both closures remain exempt from no-loop-func diagnostics.
func TestNoLoopFuncAllowsUsingBindings(t *testing.T) {
  source := `interface SymbolConstructor {
  readonly dispose: unique symbol;
  readonly asyncDispose: unique symbol;
}
interface Disposable { [Symbol.dispose](): void; }
interface AsyncDisposable { [Symbol.asyncDispose](): PromiseLike<void>; }
declare function disposable(): Disposable;
declare function asyncDisposable(): AsyncDisposable;

function synchronous(): void {
  for (let iteration = 0; iteration < 1; iteration++) {
    using resource = disposable();
    const closure = () => resource;
    // @ts-ignore -- the rule follows the constant declaration kind even when another diagnostic rejects this write.
    resource = disposable();
    void closure;
  }
}

async function asynchronous(): Promise<void> {
  for (let iteration = 0; iteration < 1; iteration++) {
    await using resource = asyncDisposable();
    const closure = () => resource;
    // @ts-ignore -- same constant-binding oracle for await using.
    resource = asyncDisposable();
    void closure;
  }
}
void [synchronous, asynchronous];
`
  assertNoLoopFuncFindings(t, runNoLoopFunc(t, source))
}
