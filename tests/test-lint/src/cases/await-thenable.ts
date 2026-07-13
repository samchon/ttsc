export {};

declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
    readonly asyncDispose: unique symbol;
  }
}

async function bad(): Promise<number> {
  // expect: typescript/await-thenable error
  return await 42;
}

async function good(): Promise<number> {
  return await Promise.resolve(1);
}

async function syncIteration(): Promise<void> {
  // expect: typescript/await-thenable error
  for await (const value of [1, 2, 3]) {
    JSON.stringify(value);
  }
}

async function asyncIteration(): Promise<void> {
  for await (const value of (async function* (): AsyncGenerator<number> {
    yield 1;
  })()) {
    JSON.stringify(value);
  }
}

async function syncDisposal(): Promise<void> {
  // expect: typescript/await-thenable error
  await using resource = {
    [Symbol.dispose](): void {},
  };
  JSON.stringify(resource);
}

async function asyncDisposal(): Promise<void> {
  await using resource = {
    async [Symbol.asyncDispose](): Promise<void> {},
  };
  JSON.stringify(resource);
}

// expect: typescript/await-thenable error
void Promise.all([42]);

void Promise.all([Promise.resolve(42)]);

JSON.stringify([
  bad,
  good,
  syncIteration,
  asyncIteration,
  syncDisposal,
  asyncDisposal,
]);
