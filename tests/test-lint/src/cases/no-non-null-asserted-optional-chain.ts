const o: { a?: { b: number } } = {} as any;
// expect: no-non-null-asserted-optional-chain error
const x = o?.a!;
JSON.stringify(x);
