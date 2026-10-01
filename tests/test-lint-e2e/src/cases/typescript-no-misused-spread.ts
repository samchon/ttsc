// Positive: object literal spread inside an array literal.
// expect: typescript/no-misused-spread error
const fromArr = [...{ a: 1 }];

// Positive: object literal spread as a call argument.
function take(...args: unknown[]): void {
  JSON.stringify(args);
}
// expect: typescript/no-misused-spread error
take(...{ a: 1 });

// Positive: object literal spread as a `new` argument.
// expect: typescript/no-misused-spread error
const set = new Set(...{ a: 1 });

// Positive: array literal spread inside an object literal.
// expect: typescript/no-misused-spread error
const fromObj = { ...[1, 2, 3] };

// Negative: array spread inside array literal is fine.
const ok1 = [...[1, 2, 3]];

// Negative: object spread inside object literal is fine.
const ok2 = { ...{ a: 1 } };

// Negative: identifier spread is opaque to AST-only rule.
const items = [1, 2, 3];
const ok3 = [...items];

JSON.stringify({ fromArr, fromObj, set, ok1, ok2, ok3 });
