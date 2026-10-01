declare function getPromise(): Promise<number>;
declare function sideEffect(): void;

// Positive: bare Promise-returning call statement.
// expect: typescript/no-floating-promises error
getPromise();

// Positive: same shape after a benign statement, inside a block.
{
  sideEffect();
  // expect: typescript/no-floating-promises error
  getPromise();
}

// Positive: `.then` with a single onFulfilled is still floating because no
// rejection handler is attached.
// expect: typescript/no-floating-promises error
getPromise().then((value) => sideEffect());

// Positive: `Promise.resolve(...)` as a discarded expression statement.
// expect: typescript/no-floating-promises error
Promise.resolve(42);

// Positive: parenthesized call is still floating.
// expect: typescript/no-floating-promises error
(getPromise());

// Negative: `await` defuses the Promise.
async function awaited(): Promise<void> {
  await getPromise();
}

// Negative: `void` operator marks the discard explicitly.
void getPromise();

// Negative: `.catch(handler)` provides a rejection handler.
getPromise().catch((error) => sideEffect());

// Negative: `.then(_, onRejected)` provides a rejection handler.
getPromise().then(
  (value) => sideEffect(),
  (error) => sideEffect(),
);

// Negative: result captured in a binding is not discarded.
const captured = getPromise();

JSON.stringify({ awaited, captured });
