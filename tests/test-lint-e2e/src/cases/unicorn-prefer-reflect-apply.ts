function f(a: number, b: number) { return a + b; }
// expect: unicorn/prefer-reflect-apply error
const r = Function.prototype.apply.call(f, null, [1, 2]);
void r;
