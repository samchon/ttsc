declare function syncWork(): number;
declare function getPromise(): Promise<number>;

// Positive: async function with no `await` in its body.
// expect: typescript/require-await error
async function noAwait(): Promise<number> {
  return syncWork();
}

// Positive: async arrow with synchronous body.
// expect: typescript/require-await error
const noAwaitArrow = async (): Promise<number> => syncWork();

// Positive: async method with no `await`.
class WithMethods {
  // expect: typescript/require-await error
  async run(): Promise<number> {
    return syncWork();
  }
}

// Positive: `await` lives inside a nested function — it does not count for
// the outer async function, which returns nothing that would exempt it.
// expect: typescript/require-await error
async function nestedAwaitInsideClosure(): Promise<void> {
  const inner = async (): Promise<number> => await getPromise();
  void inner;
}

// Negative: async function with `await` in its body.
async function withAwait(): Promise<number> {
  return await getPromise();
}

// Negative: async arrow with `await`.
const withAwaitArrow = async (): Promise<number> => await getPromise();

// Negative: synchronous function — rule does not apply.
function syncFunction(): number {
  return syncWork();
}

// Negative: async generator — exempt by design (uses `yield`).
async function* asyncGenerator(): AsyncGenerator<number> {
  yield syncWork();
}

JSON.stringify({
  noAwait,
  noAwaitArrow,
  WithMethods,
  nestedAwaitInsideClosure,
  withAwait,
  withAwaitArrow,
  syncFunction,
  asyncGenerator,
});

// Negative: no `await`, but the function returns a promise. Upstream exempts
// these — marking the function `async` forwards the inner promise to callers
// rather than leaving a refactor artifact behind.
async function forwardsPromise(): Promise<number> {
  return getPromise();
}

// Negative: `for await` awaits every step of the iteration, though it is
// spelled as a for-of carrying an await modifier rather than as an await
// expression.
async function forAwaitLoop(source: AsyncIterable<number>): Promise<void> {
  for await (const value of source) void value;
}

void forwardsPromise;
void forAwaitLoop;
