declare const obj: { foo?: { bar?: number; baz?(): number } } | null;

// expect: typescript/prefer-optional-chain error
const a = obj && obj.foo;

// expect: typescript/prefer-optional-chain error
const b = obj && obj.foo && obj.foo.bar;

// expect: typescript/prefer-optional-chain error
const c = obj != null && obj.foo;

// expect: typescript/prefer-optional-chain error
const d = obj !== null && obj.foo;

// expect: typescript/prefer-optional-chain error
const e = obj !== undefined && obj.foo;

// expect: typescript/prefer-optional-chain error
const f = obj && obj.foo && obj.foo.baz();

// Different chain — left side does not prefix the right side; safe.
declare const other: { bar?: number } | null;
const valid1 = obj && other!.bar;

// Call with arguments — `?.()` would change argument evaluation; safe.
declare const callable: { run?(x: number): number } | null;
const valid2 = callable && callable.run!(1);

JSON.stringify([a, b, c, d, e, f, valid1, valid2]);
