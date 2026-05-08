function f(
  // expect: no-explicit-any error
  x: any,
): number {
  return Number(x);
}
f(0);
