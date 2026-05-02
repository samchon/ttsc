function f(a: number, b: number) { return a + b; }
const args: [number, number] = [1, 2];
// expect: prefer-spread error
f.apply(null, args);
