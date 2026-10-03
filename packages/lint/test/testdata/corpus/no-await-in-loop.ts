declare function getPromise(): Promise<number>;
declare function getAsyncIterator(): AsyncIterableIterator<number>;
declare function getObject(): Promise<Record<string, number>>;
declare function getValues(): Promise<number[]>;
declare function getResource(): any;
declare function getResources(): any[];
declare function shouldContinue(): boolean;

// Positive: await inside `for` loop body.
async function inForLoop(): Promise<number> {
  let total = 0;
  for (let i = 0; i < 3; i++) {
    // expect: no-await-in-loop error
    total += await getPromise();
  }
  return total;
}

// Positive: await inside `while` loop body.
async function inWhileLoop(): Promise<number> {
  let total = 0;
  let i = 0;
  while (i < 3) {
    // expect: no-await-in-loop error
    total += await getPromise();
    i++;
  }
  return total;
}

// Positive: await inside `for ... of` (plain, not for-await).
async function inForOfLoop(items: number[]): Promise<number> {
  let total = 0;
  for (const _ of items) {
    // expect: no-await-in-loop error
    total += await getPromise();
  }
  return total;
}

// Negative: await inside `for await ... of` — exempt by design.
async function inForAwaitOfLoop(): Promise<number> {
  let total = 0;
  for await (const value of getAsyncIterator()) {
    total += value;
  }
  return total;
}

// Negative: await inside a nested non-loop async function.
async function awaitNotInLoop(): Promise<number> {
  return await getPromise();
}

// Negative: await inside an inner async function — the inner function
// is the boundary, the outer loop should not be charged. The for body
// itself contains no await.
async function nestedClosureInsideLoop(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const inner = async (): Promise<number> => {
      return await getPromise();
    };
    JSON.stringify(inner);
  }
}

// A `for` initializer runs once, while its test, update, and body repeat.
async function inForPositions(): Promise<void> {
  for (
    let index = await getPromise();
    // expect: no-await-in-loop error
    await getPromise();
    // expect: no-await-in-loop error
    index = await getPromise()
  ) {
    // expect: no-await-in-loop error
    await getPromise();
    break;
  }
}

// The enumerable/iterable operand runs once; only the bodies repeat.
async function inIterablePositions(): Promise<void> {
  for (const key in await getObject()) {
    JSON.stringify(key);
    // expect: no-await-in-loop error
    await getPromise();
  }
  for (const value of await getValues()) {
    JSON.stringify(value);
    // expect: no-await-in-loop error
    await getPromise();
  }
}

// A nested for-await statement is an implicit await of every outer iteration.
async function nestedForAwait(): Promise<void> {
  while (shouldContinue()) {
    // expect: no-await-in-loop error
    for /* comments can exceed the former source-text window */ await (const value of getAsyncIterator()) {
      await Promise.resolve(value);
    }
    break;
  }
}

// The same spelling at a function boundary is intentional async iteration.
async function typedForAwaitBoundary(): Promise<void> {
  for /* comments and spacing do not affect the typed modifier */ await (const value of getAsyncIterator()) {
    await Promise.resolve(value);
  }
}

// Await-using is implicit await. A for initializer is single-shot, while a
// loop body and an await-using for-of binding repeat.
async function awaitUsingPositions(): Promise<void> {
  for (await using initialResource = getResource(); false; ) {
    JSON.stringify(initialResource);
  }
  while (shouldContinue()) {
    // expect: no-await-in-loop error
    await using bodyResource = getResource();
    JSON.stringify(bodyResource);
    break;
  }
  // expect: no-await-in-loop error
  for (await using resource of getResources()) {
    JSON.stringify(resource);
  }
}

// Function and static method bodies establish independent execution scopes.
async function functionAndClassBoundaries(): Promise<void> {
  while (shouldContinue()) {
    const nested = async (): Promise<number> => await getPromise();
    class Holder {
      static async load(): Promise<number> {
        return await getPromise();
      }
    }
    JSON.stringify({ nested, Holder });
    break;
  }
}

JSON.stringify({
  inForLoop,
  inWhileLoop,
  inForOfLoop,
  inForAwaitOfLoop,
  awaitNotInLoop,
  nestedClosureInsideLoop,
  inForPositions,
  inIterablePositions,
  nestedForAwait,
  typedForAwaitBoundary,
  awaitUsingPositions,
  functionAndClassBoundaries,
});
