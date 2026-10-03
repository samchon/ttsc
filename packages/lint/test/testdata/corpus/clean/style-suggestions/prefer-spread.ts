// @ttsc-corpus-clean: prefer-spread
function f(a: number, b: number) { return a + b; }
const args: [number, number] = [1, 2];
f(...args);
