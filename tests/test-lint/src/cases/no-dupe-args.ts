// expect: no-dupe-args error
function f(a: number, b: number, a: number) {
  return a + b;
}
f(1, 2, 3);
