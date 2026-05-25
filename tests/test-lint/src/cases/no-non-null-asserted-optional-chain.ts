const o: { a?: { b: number } } = {} as any;
// expect: noNonNullAssertedOptionalChain error
const x = o?.a!;
JSON.stringify(x);
